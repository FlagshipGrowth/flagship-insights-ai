import { getDb } from "./db";
import { insertLead } from "./leads";
import { addSuppression } from "./outbound";
import { callStructured } from "./claude-structured";
import { postSlackMessage } from "./slack";
import { BOOKING_URL } from "./outbound-copy";

// Outbound Sales Engine, phase 4: reply handling. Two steps so the important part never waits on
// an AI call:
// 1. recordReply (instant, from the sending tool's webhook, the reply-sync agent, or a person
//    logging a LinkedIn/Instagram reply): stores the reply and stops the sequence on every channel.
// 2. classifyReply (background function): sorts it into interested / not now / wrong person /
//    unsubscribe, drafts Joey's response, and acts on it: interested goes to the CRM and to Joey on
//    Slack right away, unsubscribe is suppressed everywhere.

export const REPLY_CLASSES = ["interested", "not_now", "wrong_person", "unsubscribe", "other"] as const;
export type ReplyClass = (typeof REPLY_CLASSES)[number];

export const REPLY_CLASS_LABELS: Record<ReplyClass, string> = {
  interested: "Interested",
  not_now: "Not now",
  wrong_person: "Wrong person",
  unsubscribe: "Unsubscribe",
  other: "Other",
};

export interface ReplyInput {
  channel: "email" | "linkedin" | "instagram";
  fromAddress: string | null;
  body: string;
  receivedAt: string | null;
  externalId: string | null;
  // When a person logs a reply from the CRM/VA queue they already know the prospect.
  prospectId: string | null;
}

export type RecordResult = { replyId: string; prospectId: string; duplicate: boolean } | { error: string };

export async function recordReply(input: ReplyInput): Promise<RecordResult> {
  const sql = getDb();
  if (input.externalId) {
    const [dup] = await sql`select id, prospect_id from outbound_replies where external_id = ${input.externalId}`;
    if (dup) return { replyId: dup.id, prospectId: dup.prospect_id, duplicate: true };
  }

  let prospectId = input.prospectId;
  let contactId: string | null = null;
  const from = input.fromAddress?.trim().toLowerCase() ?? null;
  if (from && input.channel === "email") {
    const [c] = await sql`select id, prospect_id from outbound_contacts where lower(email) = ${from}`;
    if (c) {
      prospectId ??= c.prospect_id;
      contactId = c.id;
    } else if (!prospectId) {
      // Someone else at the company replied (a forward, an assistant): match on the email domain.
      const domain = from.split("@")[1] ?? "";
      const [byDomain] = await sql`
        select prospect_id from outbound_contacts where split_part(lower(email), '@', 2) = ${domain} limit 1
      `;
      prospectId = byDomain?.prospect_id ?? null;
    }
  }
  if (!prospectId) return { error: `No prospect matches ${from ?? "this reply"}` };

  const [touch] = await sql`
    select id from outbound_touches where prospect_id = ${prospectId} and channel = ${input.channel} and status = 'sent'
    order by sent_at desc limit 1
  `;
  const [reply] = await sql`
    insert into outbound_replies (prospect_id, touch_id, channel, body, contact_id, from_address, external_id, received_at)
    values (${prospectId}, ${touch?.id ?? null}, ${input.channel}, ${input.body}, ${contactId}, ${from}, ${input.externalId},
            coalesce(${input.receivedAt}::timestamptz, now()))
    returning id
  `;

  // The sequence stops the moment they reply on any channel.
  await sql`update outbound_touches set status = 'cancelled' where prospect_id = ${prospectId} and status in ('needs_review', 'queued')`;
  await sql`
    update outbound_prospects set status = 'replied', status_reason = null, updated_at = now()
    where id = ${prospectId} and status in ('in_sequence', 'ready', 'audited', 'scored', 'closed')
  `;
  return { replyId: reply.id, prospectId, duplicate: false };
}

/** Fire-and-forget hand-off to the classify background function (same pattern as the Slack
 * routes: Netlify accepts with 202 immediately). */
export async function triggerClassification(replyId: string): Promise<void> {
  const secret = process.env.OUTBOUND_SYNC_SECRET;
  const origin = process.env.URL;
  if (!secret || !origin) return;
  await fetch(`${origin}/.netlify/functions/outbound-classify-reply-background`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
    body: JSON.stringify({ replyId }),
  }).catch(() => undefined);
}

export async function classifyReply(replyId: string): Promise<{ classification: ReplyClass } | { error: string }> {
  const sql = getDb();
  const [r] = await sql`
    select r.*, p.company_name, p.status as prospect_status, p.lead_id, p.tier, p.score, p.research_notes,
           c.full_name, c.email as contact_email,
           (select share_token from outbound_audits a where a.prospect_id = p.id and a.status = 'approved'
             order by reviewed_at desc limit 1) as audit_token
    from outbound_replies r
    join outbound_prospects p on p.id = r.prospect_id
    left join outbound_contacts c on c.id = r.contact_id
    where r.id = ${replyId}
  `;
  if (!r) return { error: "Unknown reply" };

  const thread = await sql`
    select channel, step_day, subject, body, sent_at from outbound_touches
    where prospect_id = ${r.prospect_id} and status = 'sent' order by sent_at
  `;
  const threadText = (thread as any[])
    .map((t) => `[Joey, ${t.channel}, day ${t.step_day}]${t.subject ? ` Subject: ${t.subject}` : ""}\n${t.body}`)
    .join("\n\n");

  const out = await callStructured<{ classification: ReplyClass; summary: string; draftResponse: string }>({
    system: `You triage replies to Joey Giazzon's cold outreach for Flagship Growth (an agency running Amazon, Walmart and TikTok Shop for consumer brands) and draft his response.

Classes:
- interested: wants to talk, asks for the call/audit details, asks pricing or how it works.
- not_now: open but not this moment (timing, busy season, revisit later).
- wrong_person: says someone else handles it (capture who, if named) or they've left.
- unsubscribe: asks to stop, remove them, not interested at all, or is hostile.
- other: auto-replies, out-of-office, anything else.

Draft response rules: Joey's voice, founder to founder, short, plain text, no fluff, signed "Joey". For interested, propose the call with ${BOOKING_URL}. For wrong_person, ask for an intro to the right person. For not_now, ask when to check back. For unsubscribe, write a one-line confirmation that they won't hear from us again. For other, an empty string.`,
    prompt: `Brand: ${r.company_name}\nTheir reply (${r.channel}${r.from_address ? `, from ${r.from_address}` : ""}):\n"""\n${r.body}\n"""\n\nWhat Joey sent before:\n${threadText || "(not recorded)"}`,
    toolName: "triage_reply",
    toolDescription: "Return the classification, a one-sentence summary, and the draft response.",
    schema: {
      type: "object",
      properties: {
        classification: { type: "string", enum: [...REPLY_CLASSES] },
        summary: { type: "string" },
        draftResponse: { type: "string" },
      },
      required: ["classification", "summary", "draftResponse"],
      additionalProperties: false,
    },
    maxTokens: 8000,
    effort: "low",
  });

  await sql`
    update outbound_replies set classification = ${out.classification}, summary = ${out.summary}, draft_response = ${out.draftResponse}
    where id = ${replyId}
  `;

  if (out.classification === "unsubscribe") {
    // Honored across every channel: their address, and the brand itself.
    if (r.from_address) await addSuppression("email", r.from_address, "opt_out", "Replied asking to stop", "outbound engine");
    await addSuppression("company", r.company_name, "opt_out", "Replied asking to stop", "outbound engine");
  } else if (out.classification === "not_now") {
    await sql`update outbound_prospects set status = 'closed', status_reason = ${`Not now: ${out.summary}`}, updated_at = now() where id = ${r.prospect_id}`;
  } else if (out.classification === "interested") {
    let leadId = r.lead_id as string | null;
    const auditUrl = r.audit_token ? `${process.env.URL ?? ""}/audit/${r.audit_token}` : null;
    if (!leadId) {
      leadId = await insertLead({
        companyName: r.company_name,
        contactName: r.full_name,
        email: r.contact_email ?? r.from_address,
        source: "Outbound engine",
        stage: "qualified",
        isHot: true,
        notes: [`Replied interested on ${r.channel}: ${out.summary}`, auditUrl && `Audit: ${auditUrl}`, `Their reply:\n${r.body}`]
          .filter(Boolean)
          .join("\n\n"),
      });
      await sql`update outbound_prospects set lead_id = ${leadId}, updated_at = now() where id = ${r.prospect_id}`;
    }
    await notifyInterested({
      companyName: r.company_name,
      summary: out.summary,
      reply: r.body,
      draft: out.draftResponse,
      prospectId: r.prospect_id,
      auditUrl,
    });
  }
  return { classification: out.classification };
}

async function notifyInterested(n: {
  companyName: string;
  summary: string;
  reply: string;
  draft: string;
  prospectId: string;
  auditUrl: string | null;
}): Promise<void> {
  const channel = process.env.OUTBOUND_SLACK_CHANNEL_ID;
  if (!channel || !process.env.SLACK_BOT_TOKEN) return;
  const origin = process.env.URL ?? "";
  const quote = (s: string) => s.slice(0, 1200).split("\n").map((l) => `> ${l}`).join("\n");
  await postSlackMessage({
    channel,
    text: `🔥 ${n.companyName} replied interested: ${n.summary}`,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `*🔥 ${n.companyName} replied interested*\n${n.summary}` } },
      { type: "section", text: { type: "mrkdwn", text: `*Their reply*\n${quote(n.reply)}` } },
      { type: "section", text: { type: "mrkdwn", text: `*Draft response*\n${quote(n.draft)}` } },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: [`<${origin}/internal/crm/outbound/${n.prospectId}|Open in the CRM>`, n.auditUrl && `<${n.auditUrl}|Their audit>`]
              .filter(Boolean)
              .join(" · "),
          },
        ],
      },
    ],
  }).catch(() => undefined);
}

export interface ReplyRow {
  id: string;
  prospectId: string;
  companyName: string;
  channel: string;
  fromAddress: string | null;
  body: string;
  classification: ReplyClass | null;
  summary: string | null;
  draftResponse: string | null;
  receivedAt: string;
  handledAt: string | null;
  handledBy: string | null;
}

function toReplyRow(r: any): ReplyRow {
  return {
    id: r.id,
    prospectId: r.prospect_id,
    companyName: r.company_name,
    channel: r.channel,
    fromAddress: r.from_address,
    body: r.body,
    classification: r.classification,
    summary: r.summary,
    draftResponse: r.draft_response,
    receivedAt: new Date(r.received_at).toISOString(),
    handledAt: r.handled_at ? new Date(r.handled_at).toISOString() : null,
    handledBy: r.handled_by,
  };
}

/** Replies nobody has dealt with yet, interested first. */
export async function getOpenReplies(): Promise<ReplyRow[]> {
  const sql = getDb();
  const rows = await sql`
    select r.*, p.company_name from outbound_replies r join outbound_prospects p on p.id = r.prospect_id
    where r.handled_at is null
    order by case r.classification when 'interested' then 0 when 'wrong_person' then 1 when 'not_now' then 2
                                   when 'other' then 3 when 'unsubscribe' then 4 else 5 end, r.received_at desc
    limit 200
  `;
  return rows.map(toReplyRow);
}

export async function getProspectReplies(prospectId: string): Promise<ReplyRow[]> {
  const sql = getDb();
  const rows = await sql`
    select r.*, p.company_name from outbound_replies r join outbound_prospects p on p.id = r.prospect_id
    where r.prospect_id = ${prospectId} order by r.received_at desc
  `;
  return rows.map(toReplyRow);
}

export async function markReplyHandled(id: string, by: string): Promise<void> {
  const sql = getDb();
  await sql`update outbound_replies set handled_at = now(), handled_by = ${by} where id = ${id} and handled_at is null`;
}
