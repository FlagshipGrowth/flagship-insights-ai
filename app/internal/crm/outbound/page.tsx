import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserContext, isOwner } from "@/lib/user-context";
import {
  getProspects,
  getOutboundSummary,
  getWeightsHistory,
  getSuppressions,
  saveWeightsAndRescore,
  addSuppression,
  PROSPECT_STATUSES,
  PROSPECT_STATUS_LABELS,
  SUPPRESSION_KINDS,
  SUPPRESSION_CATEGORIES,
  SUPPRESSION_CATEGORY_LABELS,
  type ProspectStatus,
} from "@/lib/outbound";
import { SIGNAL_KEYS, SIGNAL_LABELS, type ScoringWeights, type Tier } from "@/lib/outbound-scoring";
import { TIER_TREATMENT } from "@/lib/outbound-sequence";
import { getPilotStats, HELIUM10_COST_PER_CALL } from "@/lib/outbound-audit";
import { getSettings, updateSettings } from "@/lib/outbound-sequencer";
import { senderStatus } from "@/lib/outbound-sender";
import { inboxState } from "@/lib/instantly";
import { connectInstantly, getInstantlyOverview, syncCampaignState } from "@/lib/outbound-instantly-admin";
import { apolloConfigured } from "@/lib/outbound-email-finder";
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

async function saveSettingsAction(formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  await updateSettings(
    {
      sendingEnabled: formData.get("sendingEnabled") === "on",
      requireApproval: formData.get("requireApproval") === "on",
      reviewSampleSize: Number(formData.get("reviewSampleSize")),
      dailyNewBrands: Number(formData.get("dailyNewBrands")),
      dailyEmailCap: Number(formData.get("dailyEmailCap")),
      monthlyToolSpend: Number(formData.get("monthlyToolSpend")),
    },
    ctx.email
  );
  let error: string | null = null;
  await syncCampaignState(formData.get("sendingEnabled") === "on").catch((err) => {
    error = `Settings saved, but Instantly didn't switch: ${(err as Error).message}`;
  });
  revalidatePath("/internal/crm/outbound");
  if (error) redirect(`/internal/crm/outbound?runError=${encodeURIComponent(error)}`);
}

async function connectInstantlyAction(formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  const chosen = formData.getAll("inbox").map(String);
  let msg: string;
  try {
    const r = await connectInstantly(chosen);
    msg = r.error ? `runError=${encodeURIComponent(r.error)}` : `instantlyNote=${encodeURIComponent(r.note ?? "Connected.")}`;
  } catch (err) {
    msg = `runError=${encodeURIComponent((err as Error).message)}`;
  }
  revalidatePath("/internal/crm/outbound");
  redirect(`/internal/crm/outbound?${msg}`);
}

async function sendTestAction() {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  // Writing a fresh draft is a Claude call, so it runs in a background function.
  const origin = process.env.URL;
  const secret = process.env.OUTBOUND_SYNC_SECRET;
  if (!origin || !secret) redirect("/internal/crm/outbound?runError=OUTBOUND_SYNC_SECRET%20or%20URL%20is%20not%20set");
  await fetch(`${origin}/.netlify/functions/outbound-test-email-background`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
    body: JSON.stringify({ to: ctx.email }),
  });
  redirect(
    `/internal/crm/outbound?instantlyNote=${encodeURIComponent(
      `Writing a fresh draft with the current rules and sending it to ${ctx.email}. It arrives in about a minute, with the time in the subject.`
    )}`
  );
}

async function runDailyNowAction() {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  const origin = process.env.URL;
  const secret = process.env.OUTBOUND_SYNC_SECRET;
  if (!origin || !secret) redirect("/internal/crm/outbound?runError=OUTBOUND_SYNC_SECRET%20or%20URL%20is%20not%20set");
  await fetch(`${origin}/.netlify/functions/outbound-daily-background`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
  redirect("/internal/crm/outbound?runStarted=1");
}

async function addSuppressionAction(formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  const kind = formData.get("kind") as string;
  const value = (formData.get("value") as string) ?? "";
  const category = formData.get("category") as string;
  const reason = (formData.get("reason") as string)?.trim() || null;
  await addSuppression(kind, value, category, reason, ctx.email);
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
  searchParams: Promise<{ tier?: string; status?: string; weightsError?: string; weightsSaved?: string; runStarted?: string; runError?: string; instantlyNote?: string }>;
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
    getSuppressions(),
  ]);
  const [pilot, settings] = await Promise.all([getPilotStats(), getSettings()]);
  const instantly = await getInstantlyOverview();
  const sender = instantly.campaign
    ? { configured: true, message: `Sending through Instantly (campaign "${instantly.campaign.name}").` }
    : instantly.configured
      ? { configured: false, message: "Instantly's key is set but it isn't connected yet: use Connect Instantly below." }
      : senderStatus();
  const active = weightsHistory[0];

  return (
    <main>
      <a href="/internal/crm" className="back-link">
        &larr; Back to CRM
      </a>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
        <h1 style={{ margin: 0 }}>Outbound engine</h1>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <a href="/internal/crm/outbound/queue">Queue</a>
          <a href="/internal/crm/outbound/report">Report</a>
          <form action={runDailyNowAction}>
            <button type="submit" style={{ background: "var(--paper-2)", color: "var(--ink)" }}>
              Run daily step now
            </button>
          </form>
        </div>
      </header>
      <p style={{ color: "var(--muted)", marginTop: 0, marginBottom: 16, maxWidth: 760 }}>
        <small>
          Brands sourced, scored and audited by the outbound engine, then written into a sequence and sent. A prospect
          becomes a CRM lead when it replies interested or when you push it to the pipeline.
        </small>
      </p>
      {params.runStarted && <p>✅ Daily step started. New sequences show up in the queue within a few minutes.</p>}
      {params.runError && <p style={{ color: "#DC2626" }}>⚠️ {params.runError}</p>}
      {params.instantlyNote && <p>✅ {params.instantlyNote}</p>}

      <section className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Engine settings</h2>
        <p style={{ marginTop: 0 }}>
          <small style={{ color: sender.configured ? "var(--muted)" : "#DC2626" }}>
            {sender.message} Sequences are still written and queued for review either way; nothing emails a prospect until
            sending is on and a sending tool is connected.
          </small>
        </p>
        <form action={saveSettingsAction} style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end", fontSize: "0.88rem" }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" name="sendingEnabled" defaultChecked={settings.sendingEnabled} /> Sending on
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" name="requireApproval" defaultChecked={settings.requireApproval} /> Every message needs my approval
          </label>
          <label>
            New brands / day
            <br />
            <input type="number" name="dailyNewBrands" min={0} max={500} defaultValue={settings.dailyNewBrands} style={{ width: 80 }} />
          </label>
          <label>
            Emails / day cap
            <br />
            <input type="number" name="dailyEmailCap" min={0} max={2000} defaultValue={settings.dailyEmailCap} style={{ width: 80 }} />
          </label>
          <label>
            Review sample (brands)
            <br />
            <input type="number" name="reviewSampleSize" min={1} max={100} defaultValue={settings.reviewSampleSize} style={{ width: 80 }} />
          </label>
          <label>
            Monthly tool spend ($)
            <br />
            <input type="number" name="monthlyToolSpend" min={0} step={1} defaultValue={settings.monthlyToolSpend} style={{ width: 90 }} />
          </label>
          <button type="submit">Save</button>
        </form>
        <p style={{ marginBottom: 0 }}>
          <small style={{ color: "var(--muted)" }}>
            Ramp new brands/day up over 3-4 weeks as inboxes warm (the plan&apos;s 50-100+ is the target, not the start). Tool
            spend feeds cost per booked call.
          </small>
        </p>
      </section>

      <section className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Sending (Instantly) and finding emails (Apollo)</h2>
        {!instantly.configured ? (
          <p style={{ marginTop: 0 }}>
            <small style={{ color: "#DC2626" }}>INSTANTLY_API_KEY isn&apos;t set in Netlify.</small>
          </p>
        ) : instantly.error ? (
          <p style={{ marginTop: 0, color: "#DC2626" }}>
            <small>Instantly said: {instantly.error}</small>
          </p>
        ) : instantly.campaign ? (
          <div style={{ fontSize: "0.88rem" }}>
            <p style={{ marginTop: 0 }}>
              Connected. Campaign <strong>{instantly.campaign.name}</strong> is{" "}
              <strong>{instantly.campaign.status === 1 ? "running" : "paused"}</strong>
              {instantly.campaign.status === 1 ? "" : " (it starts when you tick Sending on and save)"}. Replies come back{" "}
              {instantly.webhookConnected ? "instantly by webhook, and" : ""} every 15 minutes.
            </p>
            <form action={sendTestAction} style={{ display: "inline" }}>
              <button type="submit" style={{ background: "var(--paper-2)", color: "var(--ink)" }}>
                Send a test email to me
              </button>
            </form>{" "}
            <small style={{ color: "var(--muted)" }}>Goes only to {ctx.email}, never to a brand.</small>
          </div>
        ) : (
          <form action={connectInstantlyAction} style={{ fontSize: "0.88rem" }}>
            <p style={{ marginTop: 0 }}>
              Pick the inboxes the engine sends from. Inboxes on flagshipgrowth.com are never used. Connecting creates one
              paused campaign in Instantly with no brands in it. Nothing sends until you tick Sending on.
            </p>
            {instantly.accounts.length === 0 && <p style={{ color: "#DC2626" }}>No inboxes found in Instantly.</p>}
            {instantly.accounts.length > 0 && instantly.sendable.length === 0 && (
              <p style={{ color: "#DC2626" }}>
                None of the {instantly.accounts.length} inboxes in Instantly can be used yet (reasons next to each). Cold email
                needs inboxes on a domain other than flagshipgrowth.com. Add or reconnect them in Instantly, then reload this page.
              </p>
            )}
            {instantly.accounts.map((a) => {
              const { state, label } = inboxState(a);
              const ok = state === "ready" || state === "paused";
              return (
                <label key={a.email} style={{ display: "block", margin: "6px 0", color: ok ? "inherit" : "var(--muted)" }}>
                  <input type="checkbox" name="inbox" value={a.email} defaultChecked={ok} disabled={!ok} /> {a.email}
                  <small style={{ color: ok ? "var(--muted)" : "#DC2626" }}>
                    {" "}
                    {label}
                    {a.warmupScore != null ? `, warmup score ${a.warmupScore}` : ""}
                  </small>
                </label>
              );
            })}
            <button type="submit" style={{ marginTop: 8 }}>
              Connect Instantly
            </button>
          </form>
        )}
        <hr style={{ margin: "14px 0", border: 0, borderTop: "1px solid var(--line, #e5e7eb)" }} />
        <p style={{ margin: 0, fontSize: "0.88rem" }}>
          {apolloConfigured() ? (
            <small style={{ color: "var(--muted)" }}>
              Emails are found automatically with Apollo as soon as a brand&apos;s audit is written (founder or CEO first,
              then the e-commerce lead), and retried daily. Only emails Apollo marks verified are used.
            </small>
          ) : (
            <small style={{ color: "#DC2626" }}>APOLLO_API_KEY isn&apos;t set in Netlify.</small>
          )}
        </p>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 20 }}>
        <Stat label="Prospects" value={summary.total} href="?" />
        {TIERS.map((t) => (
          <Stat key={t} label={`Tier ${t}`} value={summary.byTier[t]} href={`?tier=${t}`} />
        ))}
        <Stat label="Launch track" value={summary.launchTrack} />
        <Stat label="Added today" value={summary.addedToday} />
        <Stat label="Suppressed / disqualified" value={summary.suppressedOrDisqualified} />
      </div>

      <section className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Audit pilot</h2>
        <p style={{ marginTop: 0 }}>
          <small style={{ color: "var(--muted)" }}>
            Gate before scaling: approve the audit format and the cost per audit. Cost uses Helium10&apos;s top-up price
            (${HELIUM10_COST_PER_CALL.toFixed(2)} per call). Review each draft on its prospect page.
          </small>
        </p>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: "0.9rem" }}>
          <span>
            <strong>{pilot.total}</strong> audits ({pilot.draft} to review, {pilot.approved} approved, {pilot.rejected} rejected)
          </span>
          <span>
            Avg Helium10 calls: <strong>{pilot.avgHelium10Calls === null ? "–" : pilot.avgHelium10Calls.toFixed(1)}</strong>
          </span>
          <span>
            Cost per audit: <strong>{pilot.avgCostPerAudit === null ? "–" : `$${pilot.avgCostPerAudit.toFixed(2)}`}</strong>
          </span>
          <span>
            Helium10 calls this month: <strong>{pilot.helium10CallsThisMonth}</strong> / 1,000 included
          </span>
          <span>
            Tier A/B waiting: <strong>{pilot.awaitingAudit}</strong>
          </span>
        </div>
        {pilot.draft > 0 && (
          <p style={{ marginBottom: 0 }}>
            <a href="?status=audited">Show prospects with an audit to review →</a>
          </p>
        )}
      </section>

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
              Must add up to 100. Saving creates a new version and rescores every prospect. Tier A is 70+, B is 50-69, C
              is below 50.
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
          <form action={addSuppressionAction} style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            <select name="category" defaultValue="opt_out">
              {SUPPRESSION_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {SUPPRESSION_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
            <select name="kind" defaultValue="company">
              {SUPPRESSION_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <input type="text" name="value" placeholder="brand name, domain or email" required style={{ flex: 1, minWidth: 160 }} />
            <input type="text" name="reason" placeholder="Note (optional)" style={{ flex: 1, minWidth: 120 }} />
            <button type="submit">Add</button>
          </form>
          {SUPPRESSION_CATEGORIES.map((category) => {
            const entries = suppressions.filter((s) => s.category === category);
            if (entries.length === 0) return null;
            return (
              <details key={category} style={{ marginBottom: 6 }}>
                <summary style={{ cursor: "pointer", fontSize: "0.85rem" }}>
                  <strong>{SUPPRESSION_CATEGORY_LABELS[category]}</strong>{" "}
                  <span style={{ color: "var(--muted)" }}>({entries.length})</span>
                </summary>
                <ul style={{ paddingLeft: 18, fontSize: "0.8rem", margin: "4px 0 8px" }}>
                  {entries.map((s) => (
                    <li key={`${s.kind}:${s.value}`}>
                      {s.value}
                      <span style={{ color: "var(--muted)" }}>
                        {" "}
                        · {s.kind}
                        {s.reason && ` · ${s.reason}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </section>
      </div>
    </main>
  );
}
