import { getDb } from "./lib/db";
import { postSlackMessageOrFallback } from "./lib/slack";
import { parseTaskText } from "./lib/slack-task-nlu";

// Slack requires a response to a slash command within 3 seconds, but the brand lookup + task
// insert (cold Next.js/Neon round trip, plus now an optional Claude call) can run past that,
// causing Slack's "app did not respond" error even though the task was actually created.
// app/api/slack/commands/route.ts does the fast signature-check synchronously and forwards the
// raw text here unparsed — this does the actual parsing, DB work, and posts the real
// confirmation (or error) back to the channel itself.
export default async (req: Request) => {
  const { text, userId, channelId } = (await req.json()) as {
    text: string;
    userId: string;
    channelId: string;
  };

  const sql = getDb();
  const brands = await sql`select id, name, slack_channel_id from brands order by name`;

  const parsed = await parseTaskText(text, brands.map((b: any) => b.name));

  // An explicitly named brand always wins; otherwise resolve from which Slack channel this was
  // run in — set per-brand on the internal brand hub's "Slack" section.
  const brand = parsed.brandName
    ? brands.find((b: any) => b.name.toLowerCase() === parsed.brandName!.toLowerCase()) ??
      brands.find((b: any) => b.name.toLowerCase().includes(parsed.brandName!.toLowerCase()))
    : brands.find((b: any) => b.slack_channel_id === channelId);

  if (!brand) {
    const hint = parsed.brandName
      ? `couldn't find a brand matching "${parsed.brandName}" — check the spelling and try again`
      : `this channel isn't mapped to a brand yet — mention the brand by name, or map this channel under the brand's "Slack" section on the internal brand hub`;
    await postSlackMessageOrFallback({
      channel: channelId,
      text: `⚠️ <@${userId}> tried to create a task but ${hint}.`,
    });
    return new Response("ok", { status: 200 });
  }

  const description = parsed.priority ? `Priority: ${parsed.priority}\n\nCreated via Slack.` : "Created via Slack.";
  await sql`
    insert into tasks (brand_id, title, description)
    values (${brand.id}, ${parsed.title}, ${description})
  `;

  await postSlackMessageOrFallback({
    channel: channelId,
    text: `✅ Task created for *${brand.name}* by <@${userId}>: *${parsed.title}*${parsed.priority ? ` [${parsed.priority}]` : ""}`,
  });

  return new Response("ok", { status: 200 });
};
