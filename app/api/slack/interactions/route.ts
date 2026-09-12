import { verifySlackSignature } from "@/lib/slack";

export const runtime = "nodejs"; // needs Node's crypto — don't switch this to "edge"

/**
 * Handles Slack "interactivity" — button clicks on alerts posted by
 * generate-insights-background.ts (see the "Create task" button there).
 *
 * Slack app setup:
 *  1. api.slack.com/apps -> your app -> "Interactivity & Shortcuts" -> toggle On
 *  2. Request URL: https://<netlify-domain>/api/slack/interactions
 *  3. Save, then reinstall the app if prompted.
 *
 * Interactivity payloads also need a response within 3 seconds, so this only verifies the
 * signature and parses the payload — the actual DB lookup + insert happens in
 * slack-create-task-from-insight-background.ts, which posts the real confirmation itself.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
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

  // Interactivity payloads arrive as a single "payload" form field containing JSON.
  const params = new URLSearchParams(rawBody);
  const payload = JSON.parse(params.get("payload") ?? "{}");

  if (payload.type === "block_actions") {
    const action = payload.actions?.[0];

    if (action?.action_id === "create_task_from_alert") {
      const { insightId, title } = JSON.parse(action.value);

      await fetch(new URL("/.netlify/functions/slack-create-task-from-insight-background", req.url), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insightId,
          title,
          userId: payload.user?.id,
          channelId: payload.channel?.id,
          threadTs: payload.message?.ts,
        }),
      });

      return Response.json({ ok: true });
    }
  }

  return Response.json({ ok: true });
}
