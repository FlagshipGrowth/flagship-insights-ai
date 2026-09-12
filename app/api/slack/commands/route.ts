import { verifySlackSignature } from "@/lib/slack";
import { getDb } from "@/lib/db";

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

  const sql = getDb();
  const brands = await sql`
    select id, name from brands where lower(name) = lower(${fields.client}) limit 1
  `;
  const brand = brands[0] ?? (await sql`
    select id, name from brands where name ilike ${"%" + fields.client + "%"} limit 2
  `)[0];

  if (!brand) {
    return Response.json({
      response_type: "ephemeral",
      text: `Couldn't find a brand matching "${fields.client}" — check the spelling and try again.`,
    });
  }

  const description = fields.priority ? `Priority: ${fields.priority}\n\nFlagged via Slack.` : "Flagged via Slack.";

  await sql`
    insert into tasks (brand_id, title, description)
    values (${brand.id}, ${title}, ${description})
  `;

  return Response.json({
    response_type: "in_channel",
    text: `✅ Task created for *${brand.name}* by <@${userId}>: *${title}*${fields.priority ? ` [${fields.priority}]` : ""}`,
  });
}
