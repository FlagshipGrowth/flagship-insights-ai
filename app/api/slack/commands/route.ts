import { verifySlackSignature } from "@/lib/slack";

export const runtime = "nodejs"; // needs Node's crypto — don't switch this to "edge"

/**
 * Handles the `/create-task` Slack slash command.
 *
 * Slack app setup:
 *  1. api.slack.com/apps -> your app -> "Slash Commands" -> Create New Command
 *  2. Command: /create-task
 *  3. Request URL: https://<netlify-domain>/api/slack/commands
 *  4. Reinstall the app to the workspace to pick up the new command.
 *
 * Usage: /create-task <title> | client:<brand name> | priority:<low|med|high>
 *
 * Slack requires a response within 3 seconds. This route only verifies the signature and
 * parses the text — both fast, no DB — then hands the actual brand lookup + task insert off to
 * slack-create-task-background.ts (a Netlify background function) and acks immediately. The
 * real confirmation (or "brand not found" error) gets posted to the channel a moment later by
 * that background function, not by this response.
 */
export async function POST(req: Request) {
  // Must read as raw text FIRST — verification depends on the exact raw bytes.
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

  const params = new URLSearchParams(rawBody);
  const command = params.get("command");
  const text = (params.get("text") ?? "").trim();
  const userId = params.get("user_id");
  const channelId = params.get("channel_id");

  if (command !== "/create-task") {
    return Response.json({ error: "Unknown command" }, { status: 400 });
  }

  if (!text) {
    return Response.json({
      response_type: "ephemeral",
      text: "Usage: `/create-task <title> | client:<brand name> | priority:<low|med|high>`",
    });
  }

  const [title, ...modifiers] = text.split("|").map((s) => s.trim());
  const fields: Record<string, string> = {};
  for (const mod of modifiers) {
    const [key, value] = mod.split(":").map((s) => s.trim());
    if (key && value) fields[key.toLowerCase()] = value;
  }

  if (!fields.client) {
    return Response.json({
      response_type: "ephemeral",
      text: "Missing `client:<brand name>` — e.g. `/create-task Reorder stock | client:Opopop`",
    });
  }

  // Fire the background function and wait only for Netlify to accept the invocation (near-
  // instant — background functions return 202 immediately, before their own work finishes).
  await fetch(new URL("/.netlify/functions/slack-create-task-background", req.url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      client: fields.client,
      priority: fields.priority,
      userId,
      channelId,
    }),
  });

  return Response.json({
    response_type: "ephemeral",
    text: `⏳ Creating task for "${fields.client}"…`,
  });
}
