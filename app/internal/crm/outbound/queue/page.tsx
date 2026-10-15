import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserContext, isInternalStaff, isOwner } from "@/lib/user-context";
import {
  approveAllClean,
  approveTouch,
  getManualQueue,
  getReviewQueue,
  getSettings,
  markManualTouchSent,
  skipTouch,
  type TouchRow,
} from "@/lib/outbound-sequencer";
import { getOpenReplies, markReplyHandled, recordReply, triggerClassification, REPLY_CLASS_LABELS } from "@/lib/outbound-replies";
import { OutboundTierBadge } from "@/components/OutboundTierBadge";

// The engine's daily work surface:
// - Review (owners): messages waiting for approval. Edit, approve, skip, or approve everything
//   clean once the sample reads right.
// - Send by hand (any internal staff, i.e. the VA): today's LinkedIn/Instagram messages to send
//   from Joey's accounts, plus a box to log a reply they got there.
// - Replies (owners): every reply nobody has dealt with, sorted by class, with the drafted response.

const PATH = "/internal/crm/outbound/queue";

async function approveAction(touchId: string, formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  const decision = formData.get("decision");
  if (decision === "skip") {
    await skipTouch(touchId, ctx.email);
  } else {
    const subject = formData.has("subject") ? ((formData.get("subject") as string).trim() || null) : null;
    const body = (formData.get("body") as string)?.trim();
    const error = await approveTouch(touchId, ctx.email, body ? { subject, body } : undefined);
    if (error) redirect(`${PATH}?tab=review&error=${encodeURIComponent(error)}`);
  }
  revalidatePath(PATH);
}

async function approveAllAction() {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  const n = await approveAllClean(ctx.email);
  revalidatePath(PATH);
  redirect(`${PATH}?tab=review&approved=${n}`);
}

async function manualSentAction(touchId: string, formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isInternalStaff(ctx)) return;
  if (formData.get("decision") === "skip") await skipTouch(touchId, ctx.email);
  else await markManualTouchSent(touchId, ctx.email);
  revalidatePath(PATH);
}

async function logReplyAction(prospectId: string, channel: "linkedin" | "instagram", formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isInternalStaff(ctx)) return;
  const body = (formData.get("body") as string)?.trim();
  if (!body) return;
  const result = await recordReply({ channel, body, prospectId, fromAddress: null, receivedAt: null, externalId: null });
  if (!("error" in result)) await triggerClassification(result.replyId);
  revalidatePath(PATH);
}

async function handledAction(replyId: string) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  await markReplyHandled(replyId, ctx.email);
  revalidatePath(PATH);
}

function TouchHeader({ t }: { t: TouchRow }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: "0.85rem", marginBottom: 6 }}>
      <a href={`/internal/crm/outbound/${t.prospectId}`} style={{ fontWeight: 700 }}>
        {t.companyName}
      </a>
      <OutboundTierBadge tier={t.tier} />
      <span style={{ color: "var(--muted)" }}>
        Day {t.stepDay} · {t.channel} · {t.kind.replace(/_/g, " ")} · {t.scheduledFor}
        {t.contactName && ` · to ${t.contactName}`}
        {t.variantLabel && ` · A/B ${t.variantLabel}`}
      </span>
      {t.flagged && <span className="badge badge-high">Needs your input</span>}
    </div>
  );
}

export default async function OutboundQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; error?: string; approved?: string }>;
}) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (!isInternalStaff(ctx)) redirect("/internal");
  const owner = isOwner(ctx);

  const params = await searchParams;
  const tab = !owner ? "manual" : params.tab === "manual" || params.tab === "replies" ? params.tab : "review";

  const [review, manual, replies, settings] = await Promise.all([
    owner ? getReviewQueue() : Promise.resolve([] as TouchRow[]),
    getManualQueue(),
    owner ? getOpenReplies() : Promise.resolve([]),
    getSettings(),
  ]);

  // Group review items by brand, and show the first N brands in full (the "daily sample").
  const byProspect = new Map<string, TouchRow[]>();
  for (const t of review) byProspect.set(t.prospectId, [...(byProspect.get(t.prospectId) ?? []), t]);
  const groups = [...byProspect.values()];
  const sample = groups.slice(0, settings.reviewSampleSize);
  const rest = groups.slice(settings.reviewSampleSize);
  const flaggedCount = review.filter((t) => t.flagged).length;

  return (
    <main style={{ maxWidth: 1000 }}>
      <a href={owner ? "/internal/crm/outbound" : "/internal"} className="back-link">
        &larr; Back
      </a>
      <h1 style={{ marginBottom: 12 }}>Outbound queue</h1>

      {owner && (
        <nav className="pill-nav">
          <a href="?tab=review" className={tab === "review" ? "active" : ""}>
            Review ({review.length})
          </a>
          <a href="?tab=manual" className={tab === "manual" ? "active" : ""}>
            Send by hand ({manual.length})
          </a>
          <a href="?tab=replies" className={tab === "replies" ? "active" : ""}>
            Replies ({replies.length})
          </a>
        </nav>
      )}

      {tab === "review" && (
        <section>
          {params.error && <p style={{ color: "#DC2626" }}>⚠️ {params.error}</p>}
          {params.approved && <p>✅ Approved {params.approved} messages.</p>}
          {!settings.requireApproval && (
            <p>
              <small style={{ color: "var(--muted)" }}>
                Approval is off, so new messages go straight to the send queue. Only messages the writer flagged as needing
                your input land here.
              </small>
            </p>
          )}
          {review.length === 0 ? (
            <div className="card">
              <small style={{ color: "var(--muted)" }}>Nothing waiting for review.</small>
            </div>
          ) : (
            <>
              <div className="card" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: "0.9rem" }}>
                  {review.length} messages across {groups.length} brands. Read the sample below; if it&apos;s right, approve the rest in one go.
                  {flaggedCount > 0 && ` ${flaggedCount} need your input and won't be approved in bulk.`}
                </span>
                <form action={approveAllAction}>
                  <button type="submit">Approve all {review.length - flaggedCount} clean messages</button>
                </form>
              </div>
              {sample.map((touches) => (
                <div key={touches[0].prospectId} className="card" style={{ marginBottom: 14 }}>
                  {touches.map((t) => (
                    <form key={t.id} action={approveAction.bind(null, t.id)} style={{ borderTop: "1px solid var(--paper-2)", padding: "10px 0" }}>
                      <TouchHeader t={t} />
                      {t.channel === "email" && t.subject !== null && (
                        <input type="text" name="subject" defaultValue={t.subject} style={{ width: "100%", marginBottom: 6, fontWeight: 600 }} />
                      )}
                      <textarea name="body" defaultValue={t.body} rows={Math.min(14, t.body.split("\n").length + 2)} style={{ width: "100%", fontFamily: "inherit", fontSize: "0.88rem" }} />
                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        <button type="submit" name="decision" value="approve">
                          Approve
                        </button>
                        <button type="submit" name="decision" value="skip" style={{ background: "var(--paper-2)", color: "var(--ink)" }}>
                          Skip this message
                        </button>
                      </div>
                    </form>
                  ))}
                </div>
              ))}
              {rest.length > 0 && (
                <details>
                  <summary style={{ cursor: "pointer" }}>
                    {rest.length} more brands ({rest.reduce((s, g) => s + g.length, 0)} messages) outside today&apos;s sample
                  </summary>
                  <ul style={{ fontSize: "0.85rem" }}>
                    {rest.map((g) => (
                      <li key={g[0].prospectId}>
                        <a href={`/internal/crm/outbound/${g[0].prospectId}`}>{g[0].companyName}</a> · {g.length} messages
                        {g.some((t) => t.flagged) && " · needs your input"}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </section>
      )}

      {tab === "manual" && (
        <section>
          <p style={{ marginTop: 0 }}>
            <small style={{ color: "var(--muted)" }}>
              Send each of these from Joey&apos;s own LinkedIn or Instagram, copy-pasted as written, then mark it sent. If they
              reply there, paste the reply below so the sequence stops on every channel.
            </small>
          </p>
          {manual.length === 0 ? (
            <div className="card">
              <small style={{ color: "var(--muted)" }}>Nothing to send by hand today.</small>
            </div>
          ) : (
            manual.map((t) => {
              const profile =
                t.channel === "linkedin"
                  ? t.linkedinUrl
                  : t.instagramHandle
                    ? `https://www.instagram.com/${t.instagramHandle.replace(/^@/, "")}/`
                    : null;
              return (
                <div key={t.id} className="card" style={{ marginBottom: 12 }}>
                  <TouchHeader t={t} />
                  {profile && (
                    <a href={profile} target="_blank" rel="noreferrer" style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                      Open {t.channel === "linkedin" ? "LinkedIn profile" : "Instagram"} ↗
                    </a>
                  )}
                  <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: "0.9rem", background: "var(--paper-2)", padding: 10, borderRadius: 8 }}>
                    {t.body}
                  </pre>
                  <form action={manualSentAction.bind(null, t.id)} style={{ display: "flex", gap: 6 }}>
                    <button type="submit" name="decision" value="sent">
                      Mark sent
                    </button>
                    <button type="submit" name="decision" value="skip" style={{ background: "var(--paper-2)", color: "var(--ink)" }}>
                      Couldn&apos;t send (skip)
                    </button>
                  </form>
                  <form action={logReplyAction.bind(null, t.prospectId, t.channel as "linkedin" | "instagram")} style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <input type="text" name="body" placeholder={`Paste their ${t.channel} reply`} style={{ flex: 1 }} />
                    <button type="submit" style={{ background: "var(--paper-2)", color: "var(--ink)" }}>
                      Log reply
                    </button>
                  </form>
                </div>
              );
            })
          )}
        </section>
      )}

      {tab === "replies" && (
        <section>
          {replies.length === 0 ? (
            <div className="card">
              <small style={{ color: "var(--muted)" }}>No open replies.</small>
            </div>
          ) : (
            replies.map((r) => (
              <div key={r.id} className="card" style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                  <a href={`/internal/crm/outbound/${r.prospectId}`} style={{ fontWeight: 700 }}>
                    {r.companyName}
                  </a>
                  <span className={`badge ${r.classification === "interested" ? "badge-high" : "badge-pending"}`}>
                    {r.classification ? REPLY_CLASS_LABELS[r.classification] : "Classifying…"}
                  </span>
                  <small style={{ color: "var(--muted)" }}>
                    {r.channel}
                    {r.fromAddress && ` · ${r.fromAddress}`} · {new Date(r.receivedAt).toLocaleString()}
                  </small>
                </div>
                {r.summary && <p style={{ margin: "0 0 6px", fontSize: "0.9rem" }}>{r.summary}</p>}
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: "0.85rem", margin: "0 0 8px" }}>{r.body}</pre>
                {r.draftResponse && (
                  <>
                    <small style={{ color: "var(--muted)" }}>Draft response</small>
                    <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: "0.88rem", background: "var(--paper-2)", padding: 10, borderRadius: 8 }}>
                      {r.draftResponse}
                    </pre>
                  </>
                )}
                <form action={handledAction.bind(null, r.id)}>
                  <button type="submit">Mark handled</button>
                </form>
              </div>
            ))
          )}
        </section>
      )}
    </main>
  );
}
