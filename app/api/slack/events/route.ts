import { verifySlackSignature } from "@/lib/slack";

export const runtime = "nodejs"; // needs Node's crypto — don't switch this to "edge"

/**
 * Handles Slack's Events API — specifically, Claude Tag's threaded replies to a /seo-listing
 * request, so the dashboard task reflects the draft without Claude Tag needing any write-access
 * to our systems: it just replies in Slack like a person would, and this is what notices.
 *
 * Slack app setup:
 *  1. api.slack.com/apps -> your app -> "Event Subscriptions" -> toggle On
 *  2. Request URL: https://<netlify-domain>/api/slack/events
 *     (Slack sends a one-time `url_verification` challenge here first — this route echoes it
 *     back automatically, nothing manual needed once the app is deployed)
 *  3. Subscribe to bot event: `message.channels`
 *  4. Reinstall the app to the workspace to pick up the new event subscription.
 *
 * Set CLAUDE_TAG_SLACK_USER_ID (Claude Tag's Slack user ID in this workspace, once it's invited —
 * find it the same way any Slack user ID is found, e.g. a members-list lookup) so this only acts
 * on Claude Tag's own replies, not every message in every channel the bot is in.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Slack's one-time setup handshake — must echo the challenge back verbatim, unsigned (it
  // arrives before the app is "installed" in the sense signature verification assumes).
  if (payload.type === "url_verification") {
    return Response.json({ challenge: payload.challenge });
  }

  const timestamp = req.headers.get("x-slack-request-timestamp") ?? "";
  const signature = req.headers.get("x-slack-signature") ?? "";
  const isValid = verifySlackSignature({
    signingSecret: process.env.SLACK_SIGNING_SECRET ?? "",
    timestamp,
    rawBody,
    signature,
  });
  if (!isValid) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Ack within Slack's 3s budget immediately; defer the actual DB lookup/update, same reasoning
  // as every other Slack-triggered write in this integration.
  if (payload.type === "event_callback" && payload.event?.type === "message") {
    const event = payload.event;
    const claudeTagUserId = process.env.CLAUDE_TAG_SLACK_USER_ID;
    const isFromClaudeTag = claudeTagUserId && event.user === claudeTagUserId;

    // Only threaded replies from Claude Tag itself, and skip edits/deletes (event.subtype set)
    // and the case where thread_ts === ts (that would be a new top-level message, not a reply).
    if (isFromClaudeTag && event.thread_ts && event.thread_ts !== event.ts && !event.subtype) {
      await fetch(new URL("/.netlify/functions/seo-listing-capture-reply-background", req.url), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: event.channel,
          threadTs: event.thread_ts,
          text: event.text,
        }),
      });
    }
  }

  return Response.json({ ok: true });
}
