import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserContext, isOwner } from "@/lib/user-context";
import { getOwnerUsers } from "@/lib/leads";
import {
  getProspectDetail,
  updateProspectStatus,
  suppressProspect,
  requestAudit,
  pushProspectToPipeline,
  PROSPECT_STATUSES,
  PROSPECT_STATUS_LABELS,
} from "@/lib/outbound";
import { SIGNAL_KEYS, SIGNAL_LABELS } from "@/lib/outbound-scoring";
import { sequenceForTier, TIER_TREATMENT } from "@/lib/outbound-sequence";
import { getAuditsForProspect, reviewAudit, HELIUM10_COST_PER_CALL } from "@/lib/outbound-audit";
import { getProspectTouches, requestPreview } from "@/lib/outbound-sequencer";
import { getProspectReplies, recordReply, triggerClassification, REPLY_CLASS_LABELS } from "@/lib/outbound-replies";
import { OutboundTierBadge } from "@/components/OutboundTierBadge";
import { ConfirmButton } from "@/components/ConfirmButton";

async function updateStatusAction(prospectId: string, formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  await updateProspectStatus(prospectId, formData.get("status") as string);
  revalidatePath(`/internal/crm/outbound/${prospectId}`);
}

async function requestAuditAction(prospectId: string) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  await requestAudit(prospectId);
  revalidatePath(`/internal/crm/outbound/${prospectId}`);
}

async function previewAction(prospectId: string) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  await requestPreview(prospectId);
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

async function reviewAuditAction(prospectId: string, auditId: string, formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  const decision = formData.get("decision");
  if (decision !== "approved" && decision !== "rejected") return;
  const note = (formData.get("note") as string)?.trim() || null;
  await reviewAudit(auditId, decision, note, ctx.email);
  revalidatePath(`/internal/crm/outbound/${prospectId}`);
  revalidatePath("/internal/crm/outbound");
}

async function logReplyAction(prospectId: string, formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  const body = (formData.get("body") as string)?.trim();
  const channel = formData.get("channel") as string;
  if (!body || !["email", "linkedin", "instagram"].includes(channel)) return;
  const result = await recordReply({
    channel: channel as "email" | "linkedin" | "instagram",
    body,
    prospectId,
    fromAddress: null,
    receivedAt: null,
    externalId: null,
  });
  if (!("error" in result)) await triggerClassification(result.replyId);
  revalidatePath(`/internal/crm/outbound/${prospectId}`);
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
  const [p, owners, audits] = await Promise.all([getProspectDetail(prospectId), getOwnerUsers(), getAuditsForProspect(prospectId)]);
  const [touches, replies] = await Promise.all([getProspectTouches(prospectId), getProspectReplies(prospectId)]);
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
          {(p.status === "scored" || p.status === "disqualified") &&
            (p.auditRequested ? (
              <p style={{ margin: "8px 0" }}>
                <small>🔎 Queued for audit. The audit agent picks it up on its next run.</small>
              </p>
            ) : (
              p.tier !== "A" &&
              p.tier !== "B" && (
                <form action={requestAuditAction.bind(null, p.id)} style={{ margin: "8px 0" }}>
                  <button type="submit" style={{ background: "var(--paper-2)", color: "var(--ink)" }}>
                    Queue for audit anyway
                  </button>{" "}
                  <small style={{ color: "var(--muted)" }}>Tier A/B brands are audited automatically.</small>
                </form>
              )
            ))}
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
          {audits.length === 0 ? (
            <small style={{ color: "var(--muted)" }}>
              {p.status === "audit_pending" ? "Claimed by the audit agent, in progress." : "None yet."}
            </small>
          ) : (
            audits.map((a) => (
              <div key={a.id} style={{ borderTop: "1px solid var(--paper-2)", padding: "10px 0", fontSize: "0.85rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                  <strong>{a.headline ?? "Untitled audit"}</strong>
                  <span className={`badge ${a.status === "approved" ? "badge-approved" : a.status === "rejected" ? "badge-rejected" : "badge-pending"}`}>
                    {a.status}
                  </span>
                </div>
                <div style={{ color: "var(--muted)", margin: "4px 0 8px" }}>
                  {a.kind} · {new Date(a.createdAt).toLocaleDateString()}
                  {a.helium10Calls !== null &&
                    ` · ${a.helium10Calls} Helium10 calls (~$${(a.helium10Calls * HELIUM10_COST_PER_CALL).toFixed(2)})`}
                  {a.hasMainImageConcept && " · with main image concept"}
                </div>
                <a href={`/audit/${a.shareToken}`} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
                  {a.status === "approved" ? "Open shareable link ↗" : "Preview draft ↗"}
                </a>
                {a.reviewNote && (
                  <p style={{ margin: "8px 0 0" }}>
                    <em>{a.reviewNote}</em> <small style={{ color: "var(--muted)" }}>· {a.reviewedBy}</small>
                  </p>
                )}
                {a.status === "draft" && (
                  <form action={reviewAuditAction.bind(null, p.id, a.id)} style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                    <input type="text" name="note" placeholder="Feedback on format/content (optional)" style={{ flex: 1, minWidth: 160 }} />
                    <button type="submit" name="decision" value="approved">
                      Approve
                    </button>
                    <button type="submit" name="decision" value="rejected" style={{ background: "var(--paper-2)", color: "var(--ink)" }}>
                      Reject
                    </button>
                  </form>
                )}
              </div>
            ))
          )}
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Email preview</h2>
          <p style={{ marginTop: 0 }}>
            <small style={{ color: "var(--muted)" }}>
              Drafts this brand&apos;s emails from its audit so you can read them before approving. Nothing is sent or
              scheduled. Takes about a minute; refresh the page to see it.
            </small>
          </p>
          <form action={previewAction.bind(null, p.id)} style={{ margin: "0 0 8px" }}>
            <button type="submit" disabled={p.preview.status === "pending"}>
              {p.preview.status === "pending" ? "Writing… refresh in a minute" : p.preview.messages.length > 0 ? "Rewrite preview" : "Preview emails"}
            </button>
          </form>
          {p.preview.status === "error" && <p style={{ color: "var(--danger, #b42318)", fontSize: "0.82rem" }}>Couldn&apos;t write the preview: {p.preview.error}</p>}
          {p.preview.messages.map((m, i) => (
            <details key={i} open={i === 0} style={{ borderTop: "1px solid var(--paper-2)", padding: "6px 0", fontSize: "0.85rem" }}>
              <summary style={{ cursor: "pointer" }}>
                <strong>Day {m.day}</strong> · {m.channel}
              </summary>
              {m.subject && <p style={{ margin: "6px 0 2px", fontWeight: 600 }}>Subject: {m.subject}</p>}
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: "4px 0" }}>{m.body}</pre>
            </details>
          ))}
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>{touches.length > 0 ? "Messages" : "Planned sequence"}</h2>
          {touches.length > 0 ? (
            touches.map((t) => (
              <details key={t.id} style={{ borderTop: "1px solid var(--paper-2)", padding: "6px 0", fontSize: "0.82rem" }}>
                <summary style={{ cursor: "pointer" }}>
                  <strong>Day {t.stepDay}</strong> · {t.channel} · {t.scheduledFor} ·{" "}
                  <span className={`badge ${t.status === "sent" ? "badge-approved" : t.status === "needs_review" ? "badge-high" : "badge-pending"}`}>
                    {t.status.replace("_", " ")}
                  </span>
                  {t.variantLabel && <span style={{ color: "var(--muted)" }}> · A/B {t.variantLabel}</span>}
                </summary>
                {t.subject && <p style={{ margin: "6px 0 2px", fontWeight: 600 }}>{t.subject}</p>}
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: "4px 0" }}>{t.body}</pre>
              </details>
            ))
          ) : p.tier ? (
            <>
              <p style={{ marginTop: 0 }}>
                <small style={{ color: "var(--muted)" }}>{TIER_TREATMENT[p.tier]}. Written when the brand is enrolled.</small>
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

        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Replies</h2>
          {replies.length === 0 && <small style={{ color: "var(--muted)" }}>None yet.</small>}
          {replies.map((r) => (
            <div key={r.id} style={{ borderTop: "1px solid var(--paper-2)", padding: "8px 0", fontSize: "0.85rem" }}>
              <span className={`badge ${r.classification === "interested" ? "badge-high" : "badge-pending"}`}>
                {r.classification ? REPLY_CLASS_LABELS[r.classification] : "Classifying…"}
              </span>{" "}
              <small style={{ color: "var(--muted)" }}>
                {r.channel} · {new Date(r.receivedAt).toLocaleString()}
              </small>
              {r.summary && <p style={{ margin: "4px 0" }}>{r.summary}</p>}
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: "4px 0" }}>{r.body}</pre>
              {r.draftResponse && (
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", background: "var(--paper-2)", padding: 8, borderRadius: 8 }}>
                  {r.draftResponse}
                </pre>
              )}
            </div>
          ))}
          <form action={logReplyAction.bind(null, p.id)} style={{ marginTop: 10 }}>
            <small style={{ color: "var(--muted)" }}>Got a reply somewhere the engine can&apos;t see? Log it to stop the sequence.</small>
            <textarea name="body" rows={3} placeholder="Paste their reply" style={{ width: "100%", fontFamily: "inherit", marginTop: 4 }} />
            <div style={{ display: "flex", gap: 6 }}>
              <select name="channel" defaultValue="email">
                <option value="email">Email</option>
                <option value="linkedin">LinkedIn</option>
                <option value="instagram">Instagram</option>
              </select>
              <button type="submit">Log reply</button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
