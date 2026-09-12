import { getDb } from "./lib/db";
import { postSlackMessage } from "./lib/slack";

// Slack requires a response to a slash command within 3 seconds, but the brand lookup + task
// insert (cold Next.js/Neon round trip) can run past that, causing Slack's "app did not respond"
// error even though the task was actually created. app/api/slack/commands/route.ts does the fast
// signature-check + parsing synchronously, then fires this off and acks immediately — this does
// the actual DB work and posts the real confirmation (or error) back to the channel itself.
export default async (req: Request) => {
  const { title, client, priority, userId, channelId } = (await req.json()) as {
    title: string;
    client: string;
    priority?: string;
    userId: string;
    channelId: string;
  };

  const sql = getDb();
  const exact = await sql`select id, name from brands where lower(name) = lower(${client}) limit 1`;
  const brand = exact[0] ?? (await sql`select id, name from brands where name ilike ${"%" + client + "%"} limit 1`)[0];

  if (!brand) {
    await postSlackMessage({
      channel: channelId,
      text: `⚠️ <@${userId}> tried to flag a task but couldn't find a brand matching "${client}" — check the spelling and try again.`,
    });
    return new Response("ok", { status: 200 });
  }

  const description = priority ? `Priority: ${priority}\n\nFlagged via Slack.` : "Flagged via Slack.";
  await sql`
    insert into tasks (brand_id, title, description)
    values (${brand.id}, ${title}, ${description})
  `;

  await postSlackMessage({
    channel: channelId,
    text: `✅ Task created for *${brand.name}* by <@${userId}>: *${title}*${priority ? ` [${priority}]` : ""}`,
  });

  return new Response("ok", { status: 200 });
};
