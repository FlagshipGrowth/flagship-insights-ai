import { getDb } from "./db";
import {
  activateCampaign,
  createEngineCampaign,
  createWebhook,
  enableWarmup,
  resumeAccount,
  setupSendingInbox,
  updateCampaign,
  getCampaign,
  instantlyConfigured,
  listAccounts,
  pauseCampaign,
  sendableAccounts,
  sendTestEmail,
  type CampaignInfo,
  type InstantlyAccount,
} from "./instantly";
import { getSettings } from "./outbound-sequencer";
import { finalEmailBody } from "./outbound-copy";

// The owner-facing side of the Instantly connection (/internal/crm/outbound): connect once,
// keep the campaign's on/off in step with "Sending on", and send a test email to yourself.
// The campaign is created paused, with no leads; a brand is only added to it by the send run
// (handOffToInstantly), which itself only runs while "Sending on" is ticked.

export interface InstantlyOverview {
  configured: boolean;
  accounts: InstantlyAccount[];
  sendable: InstantlyAccount[];
  campaign: CampaignInfo | null;
  webhookConnected: boolean;
  error: string | null;
}

export async function getInstantlyOverview(): Promise<InstantlyOverview> {
  const settings = await getSettings();
  const sql = getDb();
  const [s] = (await sql`select instantly_webhook_id from outbound_settings`) as any[];
  const base: InstantlyOverview = {
    configured: instantlyConfigured(),
    accounts: [],
    sendable: [],
    campaign: null,
    webhookConnected: !!s?.instantly_webhook_id,
    error: null,
  };
  if (!base.configured) return base;
  try {
    base.accounts = await listAccounts();
    base.sendable = sendableAccounts(base.accounts);
    if (settings.instantlyCampaignId) base.campaign = await getCampaign(settings.instantlyCampaignId);
  } catch (err) {
    base.error = (err as Error).message;
  }
  return base;
}

/** Creates the engine's campaign (paused, empty) and its webhook. Returns an error or a note. */
export async function connectInstantly(chosen: string[]): Promise<{ error?: string; note?: string }> {
  if (!instantlyConfigured()) return { error: "INSTANTLY_API_KEY isn't set in Netlify." };
  const settings = await getSettings();
  if (settings.instantlyCampaignId) return { note: "Already connected." };
  const picked = new Set(chosen.map((e) => e.toLowerCase()));
  const sendable = sendableAccounts(await listAccounts()).filter((a) => picked.has(a.email.toLowerCase()));
  if (sendable.length === 0) return { error: "Pick at least one active sending inbox." };

  // Inboxes unused for a while are usually paused, often with warmup off: wake them up first.
  for (const a of sendable.filter((a) => a.status === 2)) await resumeAccount(a.email);
  await enableWarmup(sendable.filter((a) => a.warmupStatus !== 1).map((a) => a.email));
  for (const a of sendable) await setupSendingInbox(a.email);

  const campaignId = await createEngineCampaign(
    sendable.map((a) => a.email),
    Math.max(1, settings.dailyEmailCap),
  );
  const sql = getDb();
  await sql`update outbound_settings set instantly_campaign_id = ${campaignId}, instantly_synced_at = now()`;

  let note: string | undefined;
  const origin = process.env.URL;
  const secret = process.env.OUTBOUND_SYNC_SECRET;
  if (origin && secret) {
    try {
      const hookId = await createWebhook(campaignId, `${origin}/api/outbound/instantly-webhook`, secret);
      await sql`update outbound_settings set instantly_webhook_id = ${hookId}`;
    } catch (err) {
      note = `Campaign created. The instant reply webhook couldn't be added (${(err as Error).message.slice(0, 160)}), so replies are picked up every 15 minutes instead.`;
    }
  }
  if (settings.sendingEnabled) await activateCampaign(campaignId);
  return { note: note ?? `Connected: campaign created with ${sendable.length} sending inboxes.` };
}

/** Keeps the Instantly campaign in step with the engine settings: running only while "Sending on"
 * is ticked, the daily cap matching "Emails / day cap", and every healthy inbox added (new inboxes,
 * e.g. ones finished in Zapmail after connecting, join automatically; protected ones never do). */
export async function syncCampaignState(sendingEnabled: boolean): Promise<void> {
  const settings = await getSettings();
  if (!instantlyConfigured() || !settings.instantlyCampaignId) return;
  const sendable = sendableAccounts(await listAccounts());
  for (const a of sendable.filter((a) => a.status === 2)) await resumeAccount(a.email);
  const notWarming = sendable.filter((a) => a.warmupStatus !== 1);
  await enableWarmup(notWarming.map((a) => a.email));
  for (const a of notWarming) await setupSendingInbox(a.email);
  await updateCampaign(settings.instantlyCampaignId, {
    dailyLimit: settings.dailyEmailCap,
    emailList: sendable.map((a) => a.email),
  });
  if (sendingEnabled) await activateCampaign(settings.instantlyCampaignId);
  else await pauseCampaign(settings.instantlyCampaignId);
}

/** The brand a test email is written for: the most recently previewed one, else the most recently
 * audited one. */
export async function pickTestProspect(): Promise<string | null> {
  const sql = getDb();
  const [p] = (await sql`
    select id from outbound_prospects
    where preview_at is not null
       or exists (select 1 from outbound_audits a where a.prospect_id = outbound_prospects.id and a.status <> 'rejected')
    order by preview_at desc nulls last, updated_at desc limit 1
  `) as any[];
  return p?.id ?? null;
}

/** Sends a brand's freshly written first email to `to` (the signed-in owner, never a prospect),
 * from a sending inbox, so it shows exactly what a brand would get. The subject carries the time so
 * Gmail doesn't fold repeated tests into one thread and hide the newest one as "trimmed content". */
export async function sendTestToMe(to: string, prospectId: string | null): Promise<string> {
  const sendable = sendableAccounts(await listAccounts());
  if (sendable.length === 0) throw new Error("No active sending inbox in Instantly.");
  const sql = getDb();
  const [p] = prospectId
    ? ((await sql`select company_name, preview_messages from outbound_prospects where id = ${prospectId}`) as any[])
    : [];
  const first = p && Array.isArray(p.preview_messages) ? (p.preview_messages as any[]).find((m) => m.channel === "email") : null;
  const stamp = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
  const subject = `[TEST ${stamp}: ${p?.company_name ?? "engine"}] ${first?.subject ?? "Flagship outbound engine test"}`;
  const body = finalEmailBody(first?.body ?? "This is a test from the Flagship outbound engine. If you're reading this, Instantly can send.");
  await sendTestEmail(sendable[0].email, to, subject, body);
  return `Sent from ${sendable[0].email} to ${to}${p ? ` (${p.company_name}'s first email)` : ""}.`;
}
