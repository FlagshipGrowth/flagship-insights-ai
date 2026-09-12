import { getDb } from "./lib/db";
import { postSlackMessageOrFallback } from "./lib/slack";
import { parseTaskText } from "./lib/slack-task-nlu";

const PRIORITY_OPTIONS = [
  { text: "Low", value: "low" },
  { text: "Medium", value: "med" },
  { text: "High", value: "high" },
];

// Slack requires a response to a slash command within 3 seconds, but the brand lookup + Claude
// parse can run past that, causing Slack's "app did not respond" error. app/api/slack/commands/
// route.ts does the fast signature-check synchronously and forwards the raw text here unparsed
// — this parses it, resolves the brand, and posts a button prompting for assignee/due date/
// priority. The task itself isn't created until that modal is submitted (see
// app/api/slack/interactions/route.ts's "open_task_modal"/"task_details_modal" handling and
// slack-finalize-task-background.ts) — Joey wanted those details collected before the task lands
// on the dashboard, not filled in after the fact.
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

  const initialPriority = PRIORITY_OPTIONS.find((p) => p.value === parsed.priority);

  await postSlackMessageOrFallback({
    channel: channelId,
    text: `<@${userId}> wants to create a task for *${brand.name}*: *${parsed.title}* — add a few details to finish it.`,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `*${parsed.title}*\nfor *${brand.name}*` },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Add details" },
            style: "primary",
            action_id: "open_task_modal",
            value: JSON.stringify({
              title: parsed.title,
              brandId: brand.id,
              brandName: brand.name,
              userId,
              channelId,
              initialPriority: initialPriority?.value,
            }),
          },
        ],
      },
    ],
  });

  return new Response("ok", { status: 200 });
};
