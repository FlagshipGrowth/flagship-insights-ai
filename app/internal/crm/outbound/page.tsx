import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserContext, isOwner } from "@/lib/user-context";
import {
  getProspects,
  getOutboundSummary,
  getWeightsHistory,
  getRecentSuppressions,
  saveWeightsAndRescore,
  addSuppression,
  PROSPECT_STATUSES,
  PROSPECT_STATUS_LABELS,
  SUPPRESSION_KINDS,
  type ProspectStatus,
} from "@/lib/outbound";
import { SIGNAL_KEYS, SIGNAL_LABELS, type ScoringWeights, type Tier } from "@/lib/outbound-scoring";
import { TIER_TREATMENT } from "@/lib/outbound-sequence";
import { OutboundTierBadge } from "@/components/OutboundTierBadge";

const TIERS: Tier[] = ["A", "B", "C"];

async function saveWeightsAction(formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  const weights = Object.fromEntries(SIGNAL_KEYS.map((k) => [k, Number(formData.get(k))])) as unknown as ScoringWeights;
  const note = (formData.get("note") as string)?.trim() || null;
  const error = await saveWeightsAndRescore(weights, note, ctx.email);
  revalidatePath("/internal/crm/outbound");
  redirect(error ? `/internal/crm/outbound?weightsError=${encodeURIComponent(error)}` : "/internal/crm/outbound?weightsSaved=1");
}

async function addSuppressionAction(formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  const kind = formData.get("kind") as string;
  const value = (formData.get("value") as string) ?? "";
  const reason = (formData.get("reason") as string)?.trim() || null;
  await addSuppression(kind, value, reason, ctx.email);
  revalidatePath("/internal/crm/outbound");
}

function Stat({ label, value, href }: { label: string; value: number | string; href?: string }) {
  const inner = (
    <>
      <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{label}</div>
      <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{value}</div>
    </>
  );
  return (
    <div className="card" style={{ padding: "10px 14px" }}>
      {href ? (
        <a href={href} style={{ color: "inherit", textDecoration: "none" }}>
          {inner}
        </a>
      ) : (
        inner
      )}
    </div>
  );
}

export default async function OutboundPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; status?: string; weightsError?: string; weightsSaved?: string }>;
}) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (!isOwner(ctx)) redirect("/internal");

  const params = await searchParams;
  const tier = TIERS.includes(params.tier as Tier) ? (params.tier as Tier) : null;
  const status = (PROSPECT_STATUSES as readonly string[]).includes(params.status ?? "") ? (params.status as ProspectStatus) : null;

  const [prospects, summary, weightsHistory, suppressions] = await Promise.all([
    getProspects({ tier, status }),
    getOutboundSummary(),
    getWeightsHistory(),
    getRecentSuppressions(10),
  ]);
  const active = weightsHistory[0];

  return (
    <main>
      <a href="/internal/crm" className="back-link">
        &larr; Back to CRM
      </a>
      <h1 style={{ marginBottom: 4 }}>Outbound engine</h1>
      <p style={{ color: "var(--muted)", marginTop: 0, marginBottom: 16, maxWidth: 760 }}>
        <small>
          Brands sourced and scored by the outbound engine. A prospect becomes a CRM lead when it replies with interest
          or when you push it to the pipeline. Phase 1 (scoring) is live. Audits, sending, A/B testing and reply
          handling come in later phases, so for now prospects stop at "Scored".
        </small>
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 20 }}>
        <Stat label="Prospects" value={summary.total} href="?" />
        {TIERS.map((t) => (
          <Stat key={t} label={`Tier ${t}`} value={summary.byTier[t]} href={`?tier=${t}`} />
        ))}
        <Stat label="Launch track" value={summary.launchTrack} />
        <Stat label="Added today" value={summary.addedToday} />
        <Stat label="Suppressed / disqualified" value={summary.suppressedOrDisqualified} />
      </div>

      <section style={{ marginBottom: 28 }}>
        <form method="GET" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
          <select name="tier" defaultValue={tier ?? ""}>
            <option value="">All tiers</option>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                Tier {t}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={status ?? ""}>
            <option value="">All statuses</option>
            {PROSPECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROSPECT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <button type="submit">Filter</button>
          <small style={{ color: "var(--muted)" }}>
            {prospects.length} shown{prospects.length === 500 ? " (first 500)" : ""}
          </small>
        </form>

        {prospects.length === 0 ? (
          <div className="card">
            <small style={{ color: "var(--muted)" }}>
              No prospects yet. The outbound-sourcing agent adds them through <code>/api/outbound/ingest</code>.
            </small>
          </div>
        ) : (
          <div className="card table-scroll" style={{ padding: 0 }}>
            <table className="table-dense">
              <thead>
                <tr>
                  <th>Brand</th>
                  <th>Tier</th>
                  <th>Score</th>
                  <th>Revenue/mo</th>
                  <th>Category</th>
                  <th>Launch</th>
                  <th>Status</th>
                  <th>Decision-maker</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {prospects.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <a href={`/internal/crm/outbound/${p.id}`} style={{ fontWeight: 600 }}>
                        {p.companyName}
                      </a>
                    </td>
                    <td>
                      <OutboundTierBadge tier={p.tier} />
                    </td>
                    <td>{p.score ?? "–"}</td>
                    <td>{p.estMonthlyRevenue !== null ? `$${Math.round(p.estMonthlyRevenue).toLocaleString()}` : "–"}</td>
                    <td>{p.category ?? "–"}</td>
                    <td>{p.launchTrack ? "Yes" : ""}</td>
                    <td title={p.statusReason ?? undefined}>{PROSPECT_STATUS_LABELS[p.status]}</td>
                    <td>
                      {p.primaryContactName ?? p.primaryContactEmail ?? <span style={{ color: "var(--muted)" }}>Not found yet</span>}
                      {p.primaryContactEmail && (
                        <small style={{ color: "var(--muted)" }}> {p.primaryContactVerified ? "· verified" : "· unverified"}</small>
                      )}
                    </td>
                    <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Scoring weights</h2>
          <p style={{ marginTop: 0 }}>
            <small style={{ color: "var(--muted)" }}>
              Must add up to 100. Saving creates a new version and rescores every prospect. Tier A is 80+, B is 55-79, C
              is below 55.
            </small>
          </p>
          {params.weightsError && <p style={{ color: "#DC2626" }}>⚠️ {params.weightsError}</p>}
          {params.weightsSaved && <p>✅ Saved and rescored.</p>}
          <form action={saveWeightsAction}>
            {SIGNAL_KEYS.map((k) => (
              <label key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span>{SIGNAL_LABELS[k]}</span>
                <input type="number" name={k} min={0} max={100} step={1} defaultValue={active[k]} style={{ width: 80 }} required />
              </label>
            ))}
            <input type="text" name="note" placeholder="Why (e.g. October re-weighting)" style={{ width: "100%", margin: "6px 0 10px" }} />
            <button type="submit">Save and rescore</button>
          </form>
          <details style={{ marginTop: 12 }}>
            <summary>
              <small>History</small>
            </summary>
            <ul style={{ paddingLeft: 18, fontSize: "0.8rem" }}>
              {weightsHistory.map((w) => (
                <li key={w.id}>
                  v{w.id} · {new Date(w.createdAt).toLocaleDateString()} · {SIGNAL_KEYS.map((k) => w[k]).join("/")}
                  {w.note && ` · ${w.note}`}
                </li>
              ))}
            </ul>
          </details>
          <div style={{ marginTop: 12 }}>
            {TIERS.map((t) => (
              <p key={t} style={{ margin: "4px 0", fontSize: "0.8rem" }}>
                <OutboundTierBadge tier={t} /> {TIER_TREATMENT[t]}
              </p>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Do not contact</h2>
          <p style={{ marginTop: 0 }}>
            <small style={{ color: "var(--muted)" }}>
              {summary.suppressionCount} entries. Checked every time new prospects come in, and any existing prospect that
              matches is suppressed right away. Current clients and CRM leads are always excluded automatically.
            </small>
          </p>
          <form action={addSuppressionAction} style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            <select name="kind" defaultValue="email">
              {SUPPRESSION_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <input type="text" name="value" placeholder="email, domain or brand name" required style={{ flex: 1, minWidth: 160 }} />
            <input type="text" name="reason" placeholder="Reason (optional)" style={{ flex: 1, minWidth: 120 }} />
            <button type="submit">Add</button>
          </form>
          {suppressions.length > 0 && (
            <ul style={{ paddingLeft: 18, fontSize: "0.8rem", margin: 0 }}>
              {suppressions.map((s) => (
                <li key={`${s.kind}:${s.value}`}>
                  <strong>{s.kind}</strong> {s.value}
                  {s.reason && <span style={{ color: "var(--muted)" }}> · {s.reason}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
