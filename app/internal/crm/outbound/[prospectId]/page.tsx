import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserContext, isOwner } from "@/lib/user-context";
import { getOwnerUsers } from "@/lib/leads";
import {
  getProspectDetail,
  updateProspectStatus,
  suppressProspect,
  pushProspectToPipeline,
  PROSPECT_STATUSES,
  PROSPECT_STATUS_LABELS,
} from "@/lib/outbound";
import { SIGNAL_KEYS, SIGNAL_LABELS } from "@/lib/outbound-scoring";
import { sequenceForTier, TIER_TREATMENT } from "@/lib/outbound-sequence";
import { OutboundTierBadge } from "@/components/OutboundTierBadge";
import { ConfirmButton } from "@/components/ConfirmButton";

async function updateStatusAction(prospectId: string, formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  await updateProspectStatus(prospectId, formData.get("status") as string);
  revalidatePath(`/internal/crm/outbound/${prospectId}`);
}

async function suppressAction(prospectId: string, formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  const reason = (formData.get("reason") as string)?.trim() || null;
  await suppressProspect(prospectId, reason, ctx.email);
  revalidatePath(`/internal/crm/outbound/${prospectId}`);
}

async function pushToPipelineAction(prospectId: string, formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  await pushProspectToPipeline(prospectId, (formData.get("assignedToId") as string) || null);
  revalidatePath(`/internal/crm/outbound/${prospectId}`);
  revalidatePath("/internal/crm");
}

const FACT_LABELS: Record<string, string> = {
  mainImageWeak: "Main image weak",
  imageCount: "Image count",
  hasAPlus: "Has A+ content",
  titleWeak: "Title weak",
  keywordGaps: "Keyword gaps",
  rating: "Rating",
  reviewCount: "Reviews",
  onWalmart: "On Walmart",
  onTikTokShop: "On TikTok Shop",
  bsrChange90dPct: "BSR change, 90 days (%)",
  bsrDropExplained: "BSR drop explained",
  fundingWithin90d: "Funding in last 90 days",
  launchWithin90d: "Launch in last 90 days",
};

function formatFact(v: unknown) {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return v.toLocaleString();
  return String(v);
}

export default async function ProspectPage({ params }: { params: Promise<{ prospectId: string }> }) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (!isOwner(ctx)) redirect("/internal");

  const { prospectId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(prospectId)) notFound();
  const [p, owners] = await Promise.all([getProspectDetail(prospectId), getOwnerUsers()]);
  if (!p) notFound();

  const sequence = p.tier ? sequenceForTier(p.tier) : [];
  const factEntries = Object.entries(p.facts);

  return (
    <main style={{ maxWidth: 1000 }}>
      <a href="/internal/crm/outbound" className="back-link">
        &larr; Back to Outbound
      </a>
      <header style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
        <h1 style={{ margin: 0 }}>{p.companyName}</h1>
        <OutboundTierBadge tier={p.tier} />
        <span style={{ fontSize: "1.2rem", fontWeight: 700 }}>{p.score ?? "–"}</span>
        {p.launchTrack && <span className="badge badge-approved">Launch track</span>}
      </header>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        <small>
          {[
            p.category,
            p.estMonthlyRevenue !== null && `~$${Math.round(p.estMonthlyRevenue).toLocaleString()}/mo`,
            p.primaryAsin && `ASIN ${p.primaryAsin}`,
            p.source && `Source: ${p.source}`,
            `Added ${new Date(p.createdAt).toLocaleDateString()}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </small>
      </p>
      <p style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 0 }}>
        {p.website && (
          <a href={p.website} target="_blank" rel="noreferrer">
            Website ↗
          </a>
        )}
        {p.amazonStoreUrl && (
          <a href={p.amazonStoreUrl} target="_blank" rel="noreferrer">
            Amazon ↗
          </a>
        )}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 16 }}>
        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Status</h2>
          <form action={updateStatusAction.bind(null, p.id)} style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <select name="status" defaultValue={p.status}>
              {PROSPECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PROSPECT_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <button type="submit">Update</button>
          </form>
          {p.statusReason && (
            <p style={{ margin: "0 0 8px" }}>
              <small style={{ color: "var(--muted)" }}>{p.statusReason}</small>
            </p>
          )}
          {p.leadId ? (
            <p style={{ margin: "8px 0" }}>
              ✅ In the CRM pipeline. <a href="/internal/crm?tab=pipeline">Open pipeline →</a>
            </p>
          ) : (
            <form action={pushToPipelineAction.bind(null, p.id)} style={{ display: "flex", gap: 6, margin: "8px 0", flexWrap: "wrap" }}>
              <select name="assignedToId" defaultValue="">
                <option value="">Unassigned</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.email}
                  </option>
                ))}
              </select>
              <button type="submit">Push to pipeline</button>
            </form>
          )}
          {p.status !== "suppressed" && (
            <form action={suppressAction.bind(null, p.id)} style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <input type="text" name="reason" placeholder="Reason (optional)" style={{ flex: 1, minWidth: 120 }} />
              <ConfirmButton confirmText={`Never contact ${p.companyName}? This adds them to the do-not-contact list.`}>
                Do not contact
              </ConfirmButton>
            </form>
          )}
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Score breakdown</h2>
          {p.scoreBreakdown ? (
            <table style={{ width: "100%", fontSize: "0.82rem" }}>
              <tbody>
                {SIGNAL_KEYS.map((k) => {
                  const s = p.scoreBreakdown![k];
                  return (
                    <tr key={k}>
                      <td style={{ padding: "3px 6px 3px 0", verticalAlign: "top", whiteSpace: "nowrap" }}>{SIGNAL_LABELS[k]}</td>
                      <td style={{ padding: "3px 6px", verticalAlign: "top", fontWeight: 600 }}>{Math.round(s.points)}</td>
                      <td style={{ padding: "3px 0", color: "var(--muted)" }}>{s.reasons.join(", ") || "No signal found"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <small style={{ color: "var(--muted)" }}>Not scored.</small>
          )}
          {p.weightsId && (
            <p style={{ marginBottom: 0 }}>
              <small style={{ color: "var(--muted)" }}>Scored with weights v{p.weightsId}.</small>
            </p>
          )}
        </section>
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Decision-makers</h2>
        {p.contacts.length === 0 ? (
          <small style={{ color: "var(--muted)" }}>None found yet.</small>
        ) : (
          <div className="table-scroll">
            <table className="table-dense">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Title</th>
                  <th>Email</th>
                  <th>LinkedIn</th>
                  <th>Instagram</th>
                  <th>Personal detail</th>
                </tr>
              </thead>
              <tbody>
                {p.contacts.map((c) => (
                  <tr key={c.id}>
                    <td>
                      {c.fullName ?? "–"}
                      {c.isPrimary && <small style={{ color: "var(--muted)" }}> · primary</small>}
                    </td>
                    <td>{c.title ?? "–"}</td>
                    <td>
                      {c.email ?? "–"}
                      {c.email && <small style={{ color: c.emailVerified ? "inherit" : "#DC2626" }}> {c.emailVerified ? "✓" : "unverified"}</small>}
                    </td>
                    <td>
                      {c.linkedinUrl ? (
                        <a href={c.linkedinUrl} target="_blank" rel="noreferrer">
                          Profile ↗
                        </a>
                      ) : (
                        "–"
                      )}
                    </td>
                    <td>{c.instagramHandle ?? "–"}</td>
                    <td style={{ whiteSpace: "normal", minWidth: 200 }}>{c.personalDetail ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 16 }}>
        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Pre-screen facts</h2>
          {factEntries.length === 0 ? (
            <small style={{ color: "var(--muted)" }}>None captured.</small>
          ) : (
            <table style={{ width: "100%", fontSize: "0.82rem" }}>
              <tbody>
                {factEntries.map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ padding: "2px 6px 2px 0", color: "var(--muted)" }}>{FACT_LABELS[k] ?? k}</td>
                    <td style={{ padding: "2px 0" }}>{formatFact(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Research notes</h2>
          <p style={{ whiteSpace: "pre-wrap", fontSize: "0.85rem", margin: 0 }}>{p.researchNotes ?? "–"}</p>
        </section>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Audits</h2>
          {p.audits.length === 0 ? (
            <small style={{ color: "var(--muted)" }}>None yet. Audits start in phase 2 (the 10-brand pilot).</small>
          ) : (
            <ul style={{ paddingLeft: 18, margin: 0, fontSize: "0.85rem" }}>
              {p.audits.map((a) => (
                <li key={a.id}>
                  {a.kind} · {a.status} · {new Date(a.createdAt).toLocaleDateString()}
                  {a.helium10Calls !== null && ` · ${a.helium10Calls} Helium10 calls`}
                  {a.assetUrl && (
                    <>
                      {" "}
                      ·{" "}
                      <a href={a.assetUrl} target="_blank" rel="noreferrer">
                        Open ↗
                      </a>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Planned sequence</h2>
          {p.tier ? (
            <>
              <p style={{ marginTop: 0 }}>
                <small style={{ color: "var(--muted)" }}>{TIER_TREATMENT[p.tier]}. Not sending yet (phase 3).</small>
              </p>
              <ol style={{ paddingLeft: 18, margin: 0, fontSize: "0.82rem" }}>
                {sequence.map((s) => (
                  <li key={s.day} style={{ marginBottom: 3 }}>
                    <strong>Day {s.day}</strong> · {s.channel.replace(/_/g, " ")} · {s.description}
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <small style={{ color: "var(--muted)" }}>–</small>
          )}
        </section>
      </div>
    </main>
  );
}
