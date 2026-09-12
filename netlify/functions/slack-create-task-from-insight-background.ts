import { getDb } from "./lib/db";
import { postSlackMessageOrFallback } from "./lib/slack";

// Mirrors slack-create-task-background.ts: the "Create task" button on an insight alert also
// has to ack within Slack's 3-second interactivity window, so the DB lookup + insert happens
// here instead of in app/api/slack/interactions/route.ts.
export default async (req: Request) => {
  const { insightId, title, userId, channelId, threadTs } = (await req.json()) as {
    insightId: string;
    title: string;
    userId: string;
    channelId: string;
    threadTs?: string;
  };

  const sql = getDb();
  const insightRows = await sql`select brand_id from insights where id = ${insightId}`;
  const brandId = insightRows[0]?.brand_id;

  if (!brandId) {
    await postSlackMessageOrFallback({
      channel: channelId,
      text: `⚠️ Couldn't find the insight this alert came from — task not created.`,
      thread_ts: threadTs,
    });
    return new Response("ok", { status: 200 });
  }

  await sql`
    insert into tasks (brand_id, title, description)
    values (${brandId}, ${title}, ${`Created from a Slack alert (insight ${insightId}).`})
  `;

  await postSlackMessageOrFallback({
    channel: channelId,
    text: `✅ Task created from this alert by <@${userId}>: *${title}*`,
    thread_ts: threadTs,
  });

  return new Response("ok", { status: 200 });
};
