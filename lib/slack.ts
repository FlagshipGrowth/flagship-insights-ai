import crypto from "crypto";

const SLACK_API = "https://slack.com/api";

/**
 * ── Env vars (set in Netlify) ─────────────────────────────────────────────
 * SLACK_BOT_TOKEN         — "xoxb-..." from the Slack app's OAuth & Permissions page
 * SLACK_SIGNING_SECRET    — from the Slack app's Basic Information page
 * SLACK_ALERTS_CHANNEL_ID — channel ID the bot posts insight alerts into (e.g. "C0123ABC")
 * ───────────────────────────────────────────────────────────────────────────
 */

interface SlackMessageOptions {
  channel: string; // channel ID (e.g. "C0123ABC") or name if bot is a member
  text: string; // fallback text (shown in notifications, required even with blocks)
  blocks?: unknown[]; // Block Kit blocks for richer formatting
  thread_ts?: string; // reply in a thread
}

/** Post a message to Slack. Throws if the Slack API reports an error. */
export async function postSlackMessage({ channel, text, blocks, thread_ts }: SlackMessageOptions) {
  const res = await fetch(`${SLACK_API}/chat.postMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ channel, text, blocks, thread_ts }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack API error (chat.postMessage): ${data.error}`);
  return data as { ok: true; ts: string; channel: string };
}

/**
 * Opens a modal. `trigger_id` comes from the interaction that's opening it (a button click, a
 * slash command) and expires ~3 seconds after Slack issued it, so this must be called right
 * away — not deferred to a background function like the rest of the Slack integration.
 */
export async function openSlackView({ trigger_id, view }: { trigger_id: string; view: unknown }) {
  const res = await fetch(`${SLACK_API}/views.open`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ trigger_id, view }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack API error (views.open): ${data.error}`);
  return data;
}

/**
 * Verifies an incoming request actually came from Slack.
 * IMPORTANT: must be called with the RAW request body — read it as text
 * BEFORE any JSON.parse or form parsing, or the signature won't match.
 */
export function verifySlackSignature({
  signingSecret,
  timestamp,
  rawBody,
  signature,
}: {
  signingSecret: string;
  timestamp: string;
  rawBody: string;
  signature: string;
}): boolean {
  if (!timestamp || !signature) return false;

  // Reject requests older than 5 minutes (replay-attack protection)
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (Number(timestamp) < fiveMinutesAgo) return false;

  const baseString = `v0:${timestamp}:${rawBody}`;
  const computedSignature = "v0=" + crypto.createHmac("sha256", signingSecret).update(baseString).digest("hex");

  const a = Buffer.from(computedSignature, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
