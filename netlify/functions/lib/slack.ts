const SLACK_API = "https://slack.com/api";

/**
 * ── Env vars (set in Netlify) ─────────────────────────────────────────────
 * SLACK_BOT_TOKEN         — "xoxb-..." from the Slack app's OAuth & Permissions page
 * SLACK_ALERTS_CHANNEL_ID — channel ID this posts insight alerts into (e.g. "C0123ABC")
 * ───────────────────────────────────────────────────────────────────────────
 */

interface SlackMessageOptions {
  channel: string;
  text: string;
  blocks?: unknown[];
  thread_ts?: string;
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
