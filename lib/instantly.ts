// Instantly API v2 client (https://developer.instantly.ai). Instantly sends through campaigns,
// so the engine owns one campaign whose steps are templates filled per lead from custom
// variables: {{subject1}} and {{body1}}..{{body5}}. Follow-ups have an empty subject so Instantly
// threads them under the first email. Keyed by INSTANTLY_API_KEY (Netlify env).

import { SEQUENCE_STEPS } from "./outbound-sequence";
import { ensureSignature } from "./outbound-copy";

const BASE = "https://api.instantly.ai/api/v2";

export class InstantlyError extends Error {}

export function instantlyConfigured(): boolean {
  return !!process.env.INSTANTLY_API_KEY;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const key = process.env.INSTANTLY_API_KEY;
  if (!key) throw new InstantlyError("INSTANTLY_API_KEY is not set");
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new InstantlyError(`Instantly ${method} ${path} failed (${res.status}): ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

export interface InstantlyAccount {
  email: string;
  status: number; // 1 active, 2 paused, 3 maintenance, negative = error
  warmupStatus: number; // 1 active, 0 paused, negative = problem
  warmupScore: number | null;
  dailyLimit: number | null;
}

export async function listAccounts(): Promise<InstantlyAccount[]> {
  const out: InstantlyAccount[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 10; page++) {
    const q = new URLSearchParams({ limit: "100" });
    if (cursor) q.set("starting_after", cursor);
    const r = await call<{ items: any[]; next_starting_after?: string }>("GET", `/accounts?${q}`);
    for (const a of r.items ?? []) {
      out.push({
        email: a.email,
        status: Number(a.status),
        warmupStatus: Number(a.warmup_status),
        warmupScore: typeof a.stat_warmup_score === "number" ? a.stat_warmup_score : null,
        dailyLimit: typeof a.daily_limit === "number" ? a.daily_limit : null,
      });
    }
    if (!r.next_starting_after || (r.items ?? []).length === 0) break;
    cursor = r.next_starting_after;
  }
  return out;
}

// Joey (2026-10-15): cold email never goes out from the main domain, to protect it. Inboxes on
// these domains are never put on the engine's campaign, whatever is ticked.
export const PROTECTED_DOMAINS = ["flagshipgrowth.com"];

export function isProtectedInbox(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return PROTECTED_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

export type InboxState = "ready" | "paused" | "protected" | "error" | "banned";

/** Where an inbox stands for the engine, in plain words. Paused inboxes can still be picked:
 * Connect resumes them. Connection/sending errors need a reconnect in Instantly; a banned or
 * suspended warmup means the inbox is burnt. Instantly's codes: status 1 active, 2 paused,
 * 3 maintenance, negative = error; warmup 1 active, 0 paused, -1 banned, -2 spam folder unknown,
 * -3 permanent suspension. */
export function inboxState(a: InstantlyAccount): { state: InboxState; label: string } {
  if (isProtectedInbox(a.email)) return { state: "protected", label: "your main domain, never used for cold email" };
  if (a.warmupStatus === -1 || a.warmupStatus === -3) return { state: "banned", label: "warmup banned or suspended by Instantly, don't use" };
  if (a.status < 0) {
    const why = a.status === -1 ? "connection error" : a.status === -2 ? "soft bounce error" : "sending error";
    return { state: "error", label: `${why}: reconnect this inbox in Instantly first` };
  }
  const warm = a.warmupStatus === 1 ? "warmup on" : a.warmupStatus === 0 ? "warmup off (Connect turns it on)" : "warmup health unknown";
  if (a.status === 2) return { state: "paused", label: `paused in Instantly (Connect resumes it), ${warm}` };
  return { state: "ready", label: `active, ${warm}` };
}

/** Inboxes that can be put on the campaign (paused ones are resumed on connect). */
export function sendableAccounts(accounts: InstantlyAccount[]): InstantlyAccount[] {
  return accounts.filter((a) => ["ready", "paused"].includes(inboxState(a).state));
}

/** Sending inboxes get the same setup: Joey's name, fast-but-safe warmup (Instantly adds 4 warmup
 * emails a day up to 40), a 30/day campaign cap per inbox, and slow ramp so Instantly eases campaign
 * sends up instead of starting at the cap. */
export async function setupSendingInbox(email: string): Promise<void> {
  await call("PATCH", `/accounts/${encodeURIComponent(email)}`, {
    first_name: "Joey",
    last_name: "Giazzon",
    daily_limit: 30,
    enable_slow_ramp: true,
    warmup: { limit: 40, increment: "4" },
  });
}

/** Keeps the campaign's daily cap and inbox list in step with the engine settings. */
export async function updateCampaign(id: string, patch: { dailyLimit?: number; emailList?: string[] }): Promise<void> {
  const body: Record<string, unknown> = {};
  if (patch.dailyLimit !== undefined) body.daily_limit = Math.max(1, patch.dailyLimit);
  if (patch.emailList && patch.emailList.length > 0) body.email_list = patch.emailList;
  if (Object.keys(body).length > 0) await call("PATCH", `/campaigns/${id}`, body);
}

export async function resumeAccount(email: string): Promise<void> {
  await call("POST", `/accounts/${encodeURIComponent(email)}/resume`);
}

export async function enableWarmup(emails: string[]): Promise<void> {
  if (emails.length === 0) return;
  await call("POST", "/accounts/warmup/enable", { emails: emails.slice(0, 100) });
}

/** The engine's campaign: 5 steps on the plan's day gaps, weekdays 9-5 Central, stop on reply. */
export async function createEngineCampaign(accountEmails: string[], dailyLimit: number): Promise<string> {
  const steps = SEQUENCE_STEPS.filter((s) => s.channel === "email").map((s, i, all) => ({
    type: "email",
    delay: i + 1 < all.length ? all[i + 1].day - s.day : 0,
    delay_unit: "days",
    variants: [{ subject: i === 0 ? "{{subject1}}" : "", body: `{{body${i + 1}}}` }],
  }));
  const r = await call<{ id: string }>("POST", "/campaigns", {
    name: "Flagship Outbound Engine",
    campaign_schedule: {
      schedules: [
        {
          name: "Weekdays",
          timing: { from: "09:00", to: "17:00" },
          days: { "0": false, "1": true, "2": true, "3": true, "4": true, "5": true, "6": false },
          timezone: "America/Chicago",
        },
      ],
    },
    sequences: [{ steps }],
    email_list: accountEmails,
    daily_limit: dailyLimit,
    stop_on_reply: true,
    text_only: true,
    link_tracking: false,
    open_tracking: false,
  });
  return r.id;
}

export async function activateCampaign(id: string): Promise<void> {
  await call("POST", `/campaigns/${id}/activate`, {});
}

export async function pauseCampaign(id: string): Promise<void> {
  await call("POST", `/campaigns/${id}/pause`, {});
}

export async function createWebhook(campaignId: string, url: string, secret: string): Promise<string> {
  const r = await call<{ id: string }>("POST", "/webhooks", {
    name: "Flagship Insights outbound engine",
    target_hook_url: url,
    event_type: "all_events",
    campaign: campaignId,
    headers: { Authorization: `Bearer ${secret}` },
  });
  return r.id;
}

/** Plain text to the HTML Instantly expects in a body (line breaks as <br/>). */
export function toHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
    .replace(/\r?\n/g, "<br/>");
}

export interface LeadInput {
  campaignId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string;
  subject1: string;
  bodies: string[]; // plain text, in step order
}

export async function addLead(input: LeadInput): Promise<string> {
  const vars: Record<string, string> = { subject1: input.subject1 };
  input.bodies.forEach((b, i) => (vars[`body${i + 1}`] = toHtml(ensureSignature(b))));
  const r = await call<{ id: string }>("POST", "/leads", {
    campaign: input.campaignId,
    email: input.email,
    first_name: input.firstName,
    last_name: input.lastName,
    company_name: input.companyName,
    custom_variables: vars,
    skip_if_in_workspace: true,
  });
  if (!r.id) throw new InstantlyError("Instantly skipped this lead (already in the workspace)");
  return r.id;
}

export async function sendTestEmail(from: string, to: string, subject: string, bodyText: string): Promise<void> {
  const r = await call<{ status?: string; error?: string }>("POST", "/emails/test", {
    eaccount: from,
    to_address_email_list: to,
    subject,
    body: { html: toHtml(bodyText) },
  });
  if (r.error) throw new InstantlyError(`Instantly test email failed: ${r.error}`);
}

export interface CampaignEmail {
  id: string;
  lead: string | null;
  received: boolean;
  inbox: string | null;
  text: string;
  at: string;
}

/** The campaign's emails (sent by the campaign, and replies received) created since `since`.
 * Instantly allows 20 calls a minute here, so this stops after 10 pages. */
export async function listCampaignEmails(campaignId: string, since: string): Promise<CampaignEmail[]> {
  const out: CampaignEmail[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 10; page++) {
    const q = new URLSearchParams({ campaign_id: campaignId, limit: "100", min_timestamp_created: since, sort_order: "asc" });
    if (cursor) q.set("starting_after", cursor);
    const r = await call<{ items: any[]; next_starting_after?: string }>("GET", `/emails?${q}`);
    for (const m of r.items ?? []) {
      const ue = Number(m.ue_type);
      if (ue !== 1 && ue !== 2) continue; // 1 sent from campaign, 2 received
      out.push({
        id: m.id,
        lead: m.lead ?? null,
        received: ue === 2,
        inbox: m.eaccount ?? null,
        text: m.body?.text ?? "",
        at: m.timestamp_created ?? m.timestamp_email ?? new Date().toISOString(),
      });
    }
    if (!r.next_starting_after || (r.items ?? []).length === 0) break;
    cursor = r.next_starting_after;
  }
  return out;
}

export interface CampaignInfo {
  id: string;
  name: string;
  status: number; // 0 draft, 1 active, 2 paused, 3 completed
}

export async function getCampaign(id: string): Promise<CampaignInfo> {
  const r = await call<any>("GET", `/campaigns/${id}`);
  return { id: r.id, name: r.name, status: Number(r.status) };
}
