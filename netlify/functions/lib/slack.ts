const SLACK_API = "https://slack.com/api";

/**
 * ── Env vars (set in Netlify) ─────────────────────────────────────────────
 * SLACK_BOT_TOKEN         — "xoxb-..." from the Slack app's OAuth & Permissions page
 * SLACK_USER_TOKEN        — "xoxp-..." from the same page, once a User Token Scope (chat:write)
 *                            is added and the app reinstalled. Posting with this instead of the
 *                            bot token makes the message a genuine human-authored Slack message
 *                            (a real user_id, no bot_id) — needed for seo-listing-finalize-
 *                            background.ts's Claude Tag trigger message specifically: Claude Tag
 *                            only reacts to @-mentions in human-authored messages, never a bot's
 *                            (confirmed 2026-09-14 — a bot-posted @-mention got zero response).
 * SLACK_ALERTS_CHANNEL_ID — channel ID this posts insight alerts into (e.g. "C0123ABC")
 * ───────────────────────────────────────────────────────────────────────────
 */

interface SlackMessageOptions {
  channel: string;
  text: string;
  blocks?: unknown[];
  thread_ts?: string;
  /** Defaults to SLACK_BOT_TOKEN. Pass SLACK_USER_TOKEN to post as a real human instead of the
   * bot — see this file's env-var comment above for why that matters for Claude Tag. */
  token?: string;
}

/** Post a message to Slack. Throws if the Slack API reports an error. */
export async function postSlackMessage({ channel, text, blocks, thread_ts, token }: SlackMessageOptions) {
  const res = await fetch(`${SLACK_API}/chat.postMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token ?? process.env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ channel, text, blocks, thread_ts }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack API error (chat.postMessage): ${data.error}`);
  return data as { ok: true; ts: string; channel: string };
}

/**
 * Same as postSlackMessage, but if the target channel rejects the post (most commonly
 * "channel_not_found" — the bot hasn't been invited into that brand's channel yet), falls back
 * to posting the same text into SLACK_ALERTS_CHANNEL_ID instead of failing silently. Use this
 * for any message whose whole point is to notify a human — a raw postSlackMessage failure just
 * throws, and in a background function nothing surfaces that to anyone.
 */
export async function postSlackMessageOrFallback(opts: SlackMessageOptions): Promise<void> {
  try {
    await postSlackMessage(opts);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`postSlackMessage failed for channel ${opts.channel}: ${reason}`);
    if (process.env.SLACK_ALERTS_CHANNEL_ID) {
      await postSlackMessage({
        channel: process.env.SLACK_ALERTS_CHANNEL_ID,
        text: `⚠️ Couldn't post to <#${opts.channel}> (${reason}) — is the bot a member of that channel?\n\n${opts.text}`,
      }).catch((fallbackErr) => {
        console.error(`Fallback post to SLACK_ALERTS_CHANNEL_ID also failed: ${fallbackErr}`);
      });
    }
  }
}
