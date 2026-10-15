import { getDb } from "./db";
import { getCurrentDefaults, ensureRunningTest, pickVariant, type AbVariable } from "./outbound-ab";
import { writeSequence, NEEDS_JOEY } from "./outbound-copy";
import { getSender } from "./outbound-sender";
import { addLead, instantlyConfigured, listCampaignEmails } from "./instantly";
import { recordReply, triggerClassification } from "./outbound-replies";
import type { AuditFindings } from "./outbound-audit";
import type { Tier } from "./outbound-scoring";

// Outbound Sales Engine, phase 3/5: turning approved prospects into a scheduled sequence, the
// review gate, sending email, and the hand-send queue for LinkedIn/Instagram.

// ---------------------------------------------------------------------------------------------
// Settings

export interface OutboundSettings {
  sendingEnabled: boolean;
  requireApproval: boolean;
  reviewSampleSize: number;
  dailyNewBrands: number;
  dailyEmailCap: number;
  monthlyToolSpend: number;
  instantlyCampaignId: string | null;
  updatedBy: string | null;
  updatedAt: string;
}

export async function getSettings(): Promise<OutboundSettings> {
  const sql = getDb();
  const [s] = await sql`select * from outbound_settings`;
  return {
    sendingEnabled: s.sending_enabled,
    requireApproval: s.require_approval,
    reviewSampleSize: s.review_sample_size,
    dailyNewBrands: s.daily_new_brands,
    dailyEmailCap: s.daily_email_cap,
    monthlyToolSpend: Number(s.monthly_tool_spend),
    instantlyCampaignId: s.instantly_campaign_id ?? null,
    updatedBy: s.updated_by,
    updatedAt: new Date(s.updated_at).toISOString(),
  };
}

export async function updateSettings(input: Omit<OutboundSettings, "updatedBy" | "updatedAt" | "instantlyCampaignId">, by: string): Promise<void> {
  const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(Math.round(n) || 0, lo), hi);
  const sql = getDb();
  await sql`
    update outbound_settings set
      sending_enabled = ${input.sendingEnabled},
      require_approval = ${input.requireApproval},
      review_sample_size = ${clamp(input.reviewSampleSize, 1, 100)},
      daily_new_brands = ${clamp(input.dailyNewBrands, 0, 500)},
      daily_email_cap = ${clamp(input.dailyEmailCap, 0, 2000)},
      monthly_tool_spend = ${Math.max(0, Number(input.monthlyToolSpend) || 0)},
      updated_by = ${by}, updated_at = now()
  `;
}

// ---------------------------------------------------------------------------------------------
// Scheduling helpers

/** Day N of a sequence that starts on `start`, pushed off weekends to the next Monday. */
export function scheduleDate(start: Date, day: number): string {
  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + (day - 1)));
  const dow = d.getUTCDay();
  if (dow === 6) d.setUTCDate(d.getUTCDate() + 2);
  if (dow === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function siteOrigin(): string {
  return process.env.URL ?? "https://flagship-insights-ai.netlify.app";
}

type CopyChannels = { email: boolean; linkedin: boolean; instagram: boolean };

/** Builds the copy writer's input from a prospect row joined with its primary contact. */
function copyInputFor(
  p: any,
  audit: { url: string; headline: string | null; findings: AuditFindings } | null,
  instructions: Record<AbVariable, string>,
  channels: CopyChannels,
) {
  return {
    tier: p.tier as Tier,
    companyName: p.company_name,
    category: p.category,
    estMonthlyRevenue: p.est_monthly_revenue !== null ? Number(p.est_monthly_revenue) : null,
    researchNotes: p.research_notes,
    contactFirstName: p.full_name ? String(p.full_name).split(" ")[0] : null,
    contactTitle: p.title,
    personalDetail: p.personal_detail,
    launchTrack: p.launch_track,
    auditUrl: audit?.url ?? null,
    auditHeadline: audit?.headline ?? null,
    auditFindings: audit?.findings ?? null,
    facts: p.facts ?? {},
    firstEmailInstructions: instructions,
    channels,
  };
}

// ---------------------------------------------------------------------------------------------
// Preview: draft the sequence for one brand without enrolling it, so an owner can read the emails
// before approving its audit. Runs in netlify/functions/outbound-preview-background.ts because the
// Claude call can outlast a normal request.

export async function requestPreview(prospectId: string): Promise<void> {
  const sql = getDb();
  await sql`update outbound_prospects set preview_status = 'pending', preview_error = null where id = ${prospectId}`;
  const secret = process.env.OUTBOUND_SYNC_SECRET;
  const origin = process.env.URL;
  if (!secret || !origin) {
    await sql`update outbound_prospects set preview_status = 'error', preview_error = 'OUTBOUND_SYNC_SECRET or URL not set' where id = ${prospectId}`;
    return;
  }
  await fetch(`${origin}/.netlify/functions/outbound-preview-background`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
    body: JSON.stringify({ prospectId }),
  }).catch(() => undefined);
}

export async function writePreview(prospectId: string): Promise<void> {
  const sql = getDb();
  try {
    const [p] = (await sql`
      select p.*, c.full_name, c.title, c.personal_detail
      from outbound_prospects p
      left join lateral (
        select * from outbound_contacts where prospect_id = p.id order by is_primary desc, created_at limit 1
      ) c on true
      where p.id = ${prospectId}
    `) as any[];
    if (!p) return;
    // Latest approved audit, else the latest draft (the point is to preview before approving).
    const [audit] = (await sql`
      select share_token, headline, findings from outbound_audits
      where prospect_id = ${prospectId} and status <> 'rejected'
      order by (status = 'approved') desc, created_at desc limit 1
    `) as any[];
    const defaults = await getCurrentDefaults();
    const touches = await writeSequence(
      copyInputFor(
        p,
        audit ? { url: `${siteOrigin()}/audit/${audit.share_token}`, headline: audit.headline, findings: audit.findings } : null,
        defaults,
        { email: true, linkedin: false, instagram: false },
      ),
    );
    await sql`
      update outbound_prospects
      set preview_messages = ${JSON.stringify(touches)}::jsonb, preview_status = 'ready', preview_error = null, preview_at = now()
      where id = ${prospectId}
    `;
  } catch (err) {
    await sql`update outbound_prospects set preview_status = 'error', preview_error = ${(err as Error).message.slice(0, 500)} where id = ${prospectId}`;
  }
}

// ---------------------------------------------------------------------------------------------
// Enrollment (daily): write the sequence for the next brands and schedule it

export interface EnrollResult {
  enrolled: { prospectId: string; companyName: string; touches: number; needsReview: number }[];
  skipped: { prospectId: string; companyName: string; reason: string }[];
}

/** Picks up to `limit` brands: any brand with an approved audit ("ready", Tier A first), then
 * unaudited Tier C ("scored", light-touch). */
export async function enrollNextProspects(limit: number): Promise<EnrollResult> {
  const sql = getDb();
  const result: EnrollResult = { enrolled: [], skipped: [] };
  if (limit <= 0) return result;

  const candidates = await sql`
    select p.*, c.id as contact_id, c.full_name, c.title, c.email, c.email_verified, c.linkedin_url,
           c.instagram_handle, c.personal_detail
    from outbound_prospects p
    left join lateral (
      select * from outbound_contacts where prospect_id = p.id order by is_primary desc, created_at limit 1
    ) c on true
    -- Tier C has no audit, so it needs at least some verified listing facts to say anything real.
    where p.status = 'ready' or (p.status = 'scored' and p.tier = 'C' and not p.audit_requested and p.facts <> '{}'::jsonb)
    order by case p.tier when 'A' then 0 when 'B' then 1 else 2 end, p.score desc, p.created_at
    limit ${limit}
  `;
  if (candidates.length === 0) return result;

  const [settings, defaults, test] = await Promise.all([getSettings(), getCurrentDefaults(), ensureRunningTest()]);
  const start = new Date();

  for (const p of candidates as any[]) {
    const channels = {
      email: !!p.email && p.email_verified,
      // Email only for now (Joey, 2026-10-15); LinkedIn/Instagram stay off until he turns them back on.
      linkedin: false,
      instagram: false,
    };
    if (!channels.email) {
      await sql`update outbound_prospects set status_reason = 'No verified email to contact', updated_at = now() where id = ${p.id}`;
      result.skipped.push({ prospectId: p.id, companyName: p.company_name, reason: "No verified email" });
      continue;
    }

    let audit: { share_token: string; headline: string; findings: AuditFindings } | undefined;
    if (p.status === "ready") {
      [audit] = (await sql`
        select share_token, headline, findings from outbound_audits
        where prospect_id = ${p.id} and status = 'approved' order by reviewed_at desc limit 1
      `) as any[];
      if (!audit) {
        result.skipped.push({ prospectId: p.id, companyName: p.company_name, reason: "No approved audit" });
        continue;
      }
    }

    const variant = channels.email ? await pickVariant(test) : null;
    const instructions: Record<AbVariable, string> = { ...defaults };
    if (variant) instructions[test.variable] = variant.content;

    let touches;
    try {
      touches = await writeSequence(
        copyInputFor(p, audit ? { url: `${siteOrigin()}/audit/${audit.share_token}`, headline: audit.headline, findings: audit.findings } : null, instructions, channels),
      );
    } catch (err) {
      result.skipped.push({ prospectId: p.id, companyName: p.company_name, reason: `Copy writing failed: ${(err as Error).message}` });
      continue;
    }
    if (touches.length === 0) {
      result.skipped.push({ prospectId: p.id, companyName: p.company_name, reason: "Copy writer returned no messages" });
      continue;
    }

    const rows = touches.map((t) => {
      const channel = t.channel === "linkedin_or_instagram" ? (channels.linkedin ? "linkedin" : "instagram") : t.channel;
      const flagged = t.body.includes(NEEDS_JOEY) || (t.subject ?? "").includes(NEEDS_JOEY);
      return {
        contact_id: p.contact_id,
        channel,
        step_day: t.day,
        touch_kind: t.kind,
        subject: t.subject,
        body: t.body,
        variant_id: t.day === 1 && channel === "email" && variant ? variant.id : null,
        scheduled_for: scheduleDate(start, t.day),
        status: settings.requireApproval || flagged ? "needs_review" : "queued",
      };
    });
    await sql`
      insert into outbound_touches (prospect_id, contact_id, channel, step_day, touch_kind, subject, body, variant_id, scheduled_for, status)
      select ${p.id}, r.contact_id, r.channel, r.step_day, r.touch_kind, r.subject, r.body, r.variant_id, r.scheduled_for, r.status
      from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
        as r(contact_id uuid, channel text, step_day int, touch_kind text, subject text, body text, variant_id uuid, scheduled_for date, status text)
    `;
    await sql`update outbound_prospects set status = 'in_sequence', status_reason = null, updated_at = now() where id = ${p.id}`;
    result.enrolled.push({
      prospectId: p.id,
      companyName: p.company_name,
      touches: rows.length,
      needsReview: rows.filter((r) => r.status === "needs_review").length,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------------------------
// Review (approval gate)

export interface TouchRow {
  id: string;
  prospectId: string;
  companyName: string;
  tier: Tier | null;
  channel: "email" | "linkedin" | "instagram";
  stepDay: number;
  kind: string;
  subject: string | null;
  body: string;
  status: string;
  scheduledFor: string;
  contactName: string | null;
  contactEmail: string | null;
  linkedinUrl: string | null;
  instagramHandle: string | null;
  variantLabel: string | null;
  flagged: boolean;
}

function toTouchRow(r: any): TouchRow {
  return {
    id: r.id,
    prospectId: r.prospect_id,
    companyName: r.company_name,
    tier: r.tier,
    channel: r.channel,
    stepDay: r.step_day,
    kind: r.touch_kind,
    subject: r.subject,
    body: r.body,
    status: r.status,
    scheduledFor: new Date(r.scheduled_for).toISOString().slice(0, 10),
    contactName: r.full_name,
    contactEmail: r.email,
    linkedinUrl: r.linkedin_url,
    instagramHandle: r.instagram_handle,
    variantLabel: r.variant_label,
    flagged: String(r.body).includes(NEEDS_JOEY) || String(r.subject ?? "").includes(NEEDS_JOEY),
  };
}

export async function getReviewQueue(): Promise<TouchRow[]> {
  const sql = getDb();
  const rows = await sql`
    select t.*, p.company_name, p.tier, c.full_name, c.email, c.linkedin_url, c.instagram_handle, v.label as variant_label
    from outbound_touches t
    join outbound_prospects p on p.id = t.prospect_id
    left join outbound_contacts c on c.id = t.contact_id
    left join outbound_ab_variants v on v.id = t.variant_id
    where t.status = 'needs_review' and p.status = 'in_sequence'
    order by t.scheduled_for, p.company_name, t.step_day
    limit 1000
  `;
  return rows.map(toTouchRow);
}

/** Approve one touch, optionally with edited copy. Copy still containing [NEEDS JOEY] can't be
 * approved. */
export async function approveTouch(id: string, by: string, edit?: { subject: string | null; body: string }): Promise<string | null> {
  const sql = getDb();
  const [t] = await sql`select subject, body from outbound_touches where id = ${id} and status = 'needs_review'`;
  if (!t) return "Already handled";
  const subject = edit ? edit.subject : t.subject;
  const body = edit ? edit.body : t.body;
  if (body.includes(NEEDS_JOEY) || (subject ?? "").includes(NEEDS_JOEY)) return "Fill in the [NEEDS JOEY] part before approving";
  await sql`
    update outbound_touches set subject = ${subject}, body = ${body}, status = 'queued', reviewed_by = ${by}
    where id = ${id} and status = 'needs_review'
  `;
  return null;
}

/** Approves every touch in the queue that has no [NEEDS JOEY] placeholder. */
export async function approveAllClean(by: string): Promise<number> {
  const sql = getDb();
  const rows = await sql`
    update outbound_touches set status = 'queued', reviewed_by = ${by}
    where status = 'needs_review'
      and position(${NEEDS_JOEY} in body) = 0 and position(${NEEDS_JOEY} in coalesce(subject, '')) = 0
    returning id
  `;
  return rows.length;
}

export async function skipTouch(id: string, by: string): Promise<void> {
  const sql = getDb();
  await sql`update outbound_touches set status = 'skipped', reviewed_by = ${by} where id = ${id} and status in ('needs_review', 'queued')`;
}

// ---------------------------------------------------------------------------------------------
// Email sending (called every 15 minutes in business hours)

export interface SendRunResult {
  sent: number;
  failed: { touchId: string; error: string }[];
  cancelled: number;
  stoppedBecause: string | null;
}

async function isSuppressed(sql: ReturnType<typeof getDb>, prospectId: string, email: string): Promise<boolean> {
  const domain = email.split("@")[1] ?? "";
  const [row] = await sql`
    select 1 from outbound_suppressions s, outbound_prospects p
    where p.id = ${prospectId}
      and ((s.kind = 'email' and s.value = ${email.toLowerCase()})
        or (s.kind = 'domain' and s.value = ${domain.toLowerCase()})
        or (s.kind = 'company' and s.value = p.normalized_name))
    limit 1
  `;
  return !!row;
}

export async function sendDueEmails(batchSize: number): Promise<SendRunResult> {
  const result: SendRunResult = { sent: 0, failed: [], cancelled: 0, stoppedBecause: null };
  const settings = await getSettings();
  if (!settings.sendingEnabled) return { ...result, stoppedBecause: "Sending is turned off" };
  if (instantlyConfigured() && settings.instantlyCampaignId) return handOffToInstantly(batchSize, settings);
  const sender = getSender();
  if (!sender) return { ...result, stoppedBecause: "No sending tool connected" };

  const sql = getDb();
  const [{ n: sentToday }] = await sql`
    select count(*)::int as n from outbound_touches where channel = 'email' and status = 'sent' and sent_at >= date_trunc('day', now())
  `;
  const room = Math.min(batchSize, settings.dailyEmailCap - sentToday);
  if (room <= 0) return { ...result, stoppedBecause: "Daily email cap reached" };

  const due = await sql`
    select t.id, t.prospect_id, t.subject, t.body, t.step_day, c.email, c.full_name, c.email_verified,
           (select subject from outbound_touches f where f.prospect_id = t.prospect_id and f.channel = 'email' and f.subject is not null
             order by f.step_day limit 1) as thread_subject,
           (select external_id from outbound_touches f where f.prospect_id = t.prospect_id and f.channel = 'email' and f.status = 'sent'
             order by f.sent_at desc limit 1) as previous_external_id
    from outbound_touches t
    join outbound_prospects p on p.id = t.prospect_id
    left join outbound_contacts c on c.id = t.contact_id
    where t.channel = 'email' and t.status = 'queued' and t.scheduled_for <= current_date and p.status = 'in_sequence'
    order by case p.tier when 'A' then 0 when 'B' then 1 else 2 end, t.scheduled_for, t.step_day
    limit ${room}
  `;

  for (const t of due as any[]) {
    if (!t.email || !t.email_verified || (await isSuppressed(sql, t.prospect_id, t.email))) {
      await sql`update outbound_touches set status = 'cancelled' where id = ${t.id}`;
      result.cancelled++;
      continue;
    }
    const subject = t.subject ?? (t.thread_subject ? `Re: ${t.thread_subject}` : "Quick follow-up");
    try {
      const sent = await sender.send({
        to: t.email,
        toName: t.full_name,
        subject,
        body: t.body,
        threadKey: t.prospect_id,
        previousExternalId: t.previous_external_id,
      });
      await sql`
        update outbound_touches
        set status = 'sent', sent_at = now(), sent_by = ${sender.name}, sending_inbox = ${sent.inbox}, external_id = ${sent.externalId}
        where id = ${t.id}
      `;
      result.sent++;
    } catch (err) {
      result.failed.push({ touchId: t.id, error: (err as Error).message });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------------------------
// Instantly hand-off. Instantly sends through campaigns, so instead of sending each touch, a
// brand's whole approved email sequence goes to the engine's Instantly campaign at once (as
// per-lead variables) on its day-1 date. Instantly then sends the steps, stops on reply, and its
// webhook (handleInstantlyEvent) marks each touch sent as it goes out.

async function handOffToInstantly(batchSize: number, settings: OutboundSettings): Promise<SendRunResult> {
  const result: SendRunResult = { sent: 0, failed: [], cancelled: 0, stoppedBecause: null };
  const sql = getDb();
  const [{ n: today }] = await sql`
    select count(*)::int as n from outbound_prospects where handed_off_at >= date_trunc('day', now())
  `;
  const room = Math.min(batchSize, settings.dailyEmailCap - today);
  if (room <= 0) return { ...result, stoppedBecause: "Daily cap of new brands handed to Instantly reached" };

  // Ready brands: day 1 is due, nothing in the sequence still waits for review.
  const ready = (await sql`
    select p.id, p.company_name, c.email, c.full_name, c.email_verified
    from outbound_prospects p
    join lateral (
      select t.contact_id from outbound_touches t
      where t.prospect_id = p.id and t.channel = 'email' and t.step_day = (
        select min(step_day) from outbound_touches where prospect_id = p.id and channel = 'email')
      limit 1
    ) first on true
    left join outbound_contacts c on c.id = first.contact_id
    where p.status = 'in_sequence' and p.handed_off_at is null
      and exists (select 1 from outbound_touches t where t.prospect_id = p.id and t.channel = 'email'
                    and t.status = 'queued' and t.scheduled_for <= current_date)
      and not exists (select 1 from outbound_touches t where t.prospect_id = p.id and t.channel = 'email'
                        and t.status = 'needs_review')
    order by case p.tier when 'A' then 0 when 'B' then 1 else 2 end, p.updated_at
    limit ${room}
  `) as any[];

  for (const p of ready) {
    const touches = (await sql`
      select id, subject, body from outbound_touches
      where prospect_id = ${p.id} and channel = 'email' and status = 'queued' order by step_day
    `) as any[];
    if (!p.email || !p.email_verified || (await isSuppressed(sql, p.id, p.email))) {
      await sql`update outbound_touches set status = 'cancelled' where prospect_id = ${p.id} and status in ('queued', 'needs_review')`;
      await sql`update outbound_prospects set status = 'closed', status_reason = 'No verified email or on the do-not-contact list at send time', updated_at = now() where id = ${p.id}`;
      result.cancelled += touches.length;
      continue;
    }
    if (touches.length !== SEQUENCE_STEPS_EMAIL_COUNT || !touches[0].subject) {
      result.failed.push({ touchId: touches[0]?.id ?? p.id, error: `${p.company_name}: expected ${SEQUENCE_STEPS_EMAIL_COUNT} approved emails with a subject on the first, found ${touches.length}` });
      continue;
    }
    const [first, ...rest] = String(p.full_name ?? "").trim().split(/\s+/);
    try {
      const leadId = await addLead({
        campaignId: settings.instantlyCampaignId!,
        email: p.email,
        firstName: first || null,
        lastName: rest.join(" ") || null,
        companyName: p.company_name,
        subject1: touches[0].subject,
        bodies: touches.map((t) => t.body),
      });
      await sql`update outbound_prospects set sender_lead_id = ${leadId}, handed_off_at = now(), updated_at = now() where id = ${p.id}`;
      await sql`update outbound_touches set sent_by = 'instantly' where prospect_id = ${p.id} and channel = 'email' and status = 'queued'`;
      result.sent++;
    } catch (err) {
      result.failed.push({ touchId: touches[0].id, error: `${p.company_name}: ${(err as Error).message}` });
    }
  }
  return result;
}

const SEQUENCE_STEPS_EMAIL_COUNT = 5;

export interface InstantlyEvent {
  event_type?: string;
  lead_email?: string;
  campaign_id?: string;
  step?: number;
  email_account?: string;
  email_id?: string;
  reply_text?: string;
  reply_text_snippet?: string;
  reply_subject?: string;
  timestamp?: string;
}

async function engineContact(sql: ReturnType<typeof getDb>, email: string): Promise<{ id: string; prospect_id: string } | null> {
  const [c] = (await sql`
    select c.id, c.prospect_id from outbound_contacts c join outbound_prospects p on p.id = c.prospect_id
    where lower(c.email) = ${email} and p.handed_off_at is not null limit 1
  `) as any[];
  return c ?? null;
}

/** Instantly sent one more email to this brand: the earliest still-queued touch is the one it
 * sent. Keyed on Instantly's email id, so the webhook and the 15-minute pull never double-count. */
async function markNextTouchSent(
  sql: ReturnType<typeof getDb>,
  prospectId: string,
  emailId: string | null,
  inbox: string | null,
  at: string | null,
): Promise<boolean> {
  if (emailId) {
    const [seen] = await sql`select 1 from outbound_touches where prospect_id = ${prospectId} and external_id = ${emailId}`;
    if (seen) return false;
  }
  const rows = await sql`
    update outbound_touches set status = 'sent', sent_at = coalesce(${at}::timestamptz, now()),
      sending_inbox = ${inbox}, external_id = ${emailId}, sent_by = 'instantly'
    where id = (
      select id from outbound_touches where prospect_id = ${prospectId} and channel = 'email' and status = 'queued'
      order by step_day limit 1
    )
    returning id
  `;
  return rows.length > 0;
}

async function recordReplyFromInstantly(input: {
  fromAddress: string;
  body: string;
  externalId: string | null;
  receivedAt: string | null;
  prospectId: string;
}): Promise<string> {
  const r = await recordReply({ channel: "email", ...input });
  if ("error" in r) return r.error;
  if (!r.duplicate) await triggerClassification(r.replyId);
  return r.duplicate ? "duplicate" : "recorded";
}

/** What Instantly reports back for the engine's campaign. Returns a short note for the log. */
export async function handleInstantlyEvent(e: InstantlyEvent): Promise<string> {
  const sql = getDb();
  const email = e.lead_email?.trim().toLowerCase();
  if (!email) return "ignored: no lead_email";
  const c = await engineContact(sql, email);
  if (!c) return `ignored: ${email} isn't an engine lead`;

  switch (e.event_type) {
    case "email_sent":
      return (await markNextTouchSent(sql, c.prospect_id, e.email_id ?? null, e.email_account ?? null, e.timestamp ?? null))
        ? "email_sent"
        : "email_sent: already recorded";
    case "reply_received":
      return `reply ${await recordReplyFromInstantly({
        fromAddress: email,
        body: e.reply_text || e.reply_text_snippet || "(empty reply)",
        externalId: e.email_id ?? null,
        receivedAt: e.timestamp ?? null,
        prospectId: c.prospect_id,
      })}`;
    case "lead_unsubscribed":
      await sql`
        insert into outbound_suppressions (kind, value, category, reason, created_by)
        values ('email', ${email}, 'opt_out', 'Unsubscribed in Instantly', 'instantly')
        on conflict (kind, value) do nothing
      `;
      await sql`update outbound_touches set status = 'cancelled' where prospect_id = ${c.prospect_id} and status in ('queued', 'needs_review')`;
      await sql`update outbound_prospects set status = 'closed', status_reason = 'Unsubscribed', updated_at = now() where id = ${c.prospect_id}`;
      return "unsubscribed";
    case "email_bounced":
      await sql`update outbound_contacts set email_verified = false where id = ${c.id}`;
      await sql`update outbound_touches set status = 'cancelled' where prospect_id = ${c.prospect_id} and status in ('queued', 'needs_review')`;
      await sql`update outbound_prospects set status = 'closed', status_reason = 'Email bounced', updated_at = now() where id = ${c.prospect_id}`;
      return "bounced";
    default:
      return `ignored: ${e.event_type ?? "unknown event"}`;
  }
}

/** Every 15 minutes: pulls the campaign's sent and received emails since the last pull, so sends
 * and replies are recorded even if a webhook never arrives. */
export async function syncFromInstantly(): Promise<{ sent: number; replies: number; note: string | null }> {
  const settings = await getSettings();
  if (!instantlyConfigured() || !settings.instantlyCampaignId) return { sent: 0, replies: 0, note: "Instantly isn't connected" };
  const sql = getDb();
  const [{ instantly_synced_at: last }] = (await sql`select instantly_synced_at from outbound_settings`) as any[];
  // Overlap by an hour: everything is keyed on Instantly's email id, so re-reading is harmless.
  const since = new Date((last ? new Date(last).getTime() : Date.now() - 7 * 86400000) - 3600000).toISOString();
  const startedAt = new Date().toISOString();
  const emails = await listCampaignEmails(settings.instantlyCampaignId, since);

  let sent = 0;
  let replies = 0;
  // Oldest first, so touches are marked in the order Instantly sent them.
  for (const m of emails.sort((a, b) => a.at.localeCompare(b.at))) {
    if (!m.lead) continue;
    const c = await engineContact(sql, m.lead.toLowerCase());
    if (!c) continue;
    if (m.received) {
      const r = await recordReplyFromInstantly({
        fromAddress: m.lead.toLowerCase(),
        body: m.text || "(empty reply)",
        externalId: m.id,
        receivedAt: m.at,
        prospectId: c.prospect_id,
      });
      if (r === "recorded") replies++;
    } else if (await markNextTouchSent(sql, c.prospect_id, m.id, m.inbox, m.at)) {
      sent++;
    }
  }
  await sql`update outbound_settings set instantly_synced_at = ${startedAt}`;
  return { sent, replies, note: null };
}

// ---------------------------------------------------------------------------------------------
// LinkedIn / Instagram hand-send queue

export async function getManualQueue(): Promise<TouchRow[]> {
  const sql = getDb();
  const rows = await sql`
    select t.*, p.company_name, p.tier, c.full_name, c.email, c.linkedin_url, c.instagram_handle, null as variant_label
    from outbound_touches t
    join outbound_prospects p on p.id = t.prospect_id
    left join outbound_contacts c on c.id = t.contact_id
    where t.channel in ('linkedin', 'instagram') and t.status = 'queued' and t.scheduled_for <= current_date
      and p.status = 'in_sequence'
    order by t.scheduled_for, case p.tier when 'A' then 0 else 1 end, p.company_name
    limit 300
  `;
  return rows.map(toTouchRow);
}

export async function markManualTouchSent(id: string, by: string): Promise<void> {
  const sql = getDb();
  await sql`
    update outbound_touches set status = 'sent', sent_at = now(), sent_by = ${by}
    where id = ${id} and status = 'queued' and channel in ('linkedin', 'instagram')
  `;
}

// ---------------------------------------------------------------------------------------------
// Housekeeping

/** Prospects whose every touch is done with no reply are closed out. */
export async function closeFinishedSequences(): Promise<number> {
  const sql = getDb();
  const rows = await sql`
    update outbound_prospects p set status = 'closed', status_reason = 'Sequence finished, no reply', updated_at = now()
    where p.status = 'in_sequence'
      and not exists (select 1 from outbound_touches t where t.prospect_id = p.id and t.status in ('needs_review', 'queued'))
      and exists (select 1 from outbound_touches t where t.prospect_id = p.id)
    returning p.id
  `;
  return rows.length;
}

export async function getProspectTouches(prospectId: string): Promise<TouchRow[]> {
  const sql = getDb();
  const rows = await sql`
    select t.*, p.company_name, p.tier, c.full_name, c.email, c.linkedin_url, c.instagram_handle, v.label as variant_label
    from outbound_touches t
    join outbound_prospects p on p.id = t.prospect_id
    left join outbound_contacts c on c.id = t.contact_id
    left join outbound_ab_variants v on v.id = t.variant_id
    where t.prospect_id = ${prospectId}
    order by t.step_day, t.channel
  `;
  return rows.map(toTouchRow);
}

