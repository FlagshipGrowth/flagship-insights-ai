import { getDb } from "./lib/db";
import { postSlackMessageOrFallback } from "./lib/slack";

// Runs after the "task_details_modal" (assignee/due date/priority) is submitted — see
// app/api/slack/interactions/route.ts's view_submission handling, which acks Slack (closing the
// modal) and fires this off rather than inserting inline, same 3-second-budget reasoning as the
// rest of this integration.
export default async (req: Request) => {
  const { title, brandId, brandName, assignee, dueDate, priority, userId, channelId } = (await req.json()) as {
    title: string;
    brandId: string;
    brandName: string;
    assignee: string | null;
    dueDate: string | null;
    priority: string | null;
    userId: string;
    channelId: string;
  };

  const sql = getDb();
  const description = priority ? `Priority: ${priority}\n\nCreated via Slack.` : "Created via Slack.";
  await sql`
    insert into tasks (brand_id, title, description, assignee, due_date)
    values (${brandId}, ${title}, ${description}, ${assignee}, ${dueDate})
  `;

  const details = [
    assignee ? `assignee: ${assignee}` : null,
    dueDate ? `due ${dueDate}` : null,
    priority ? `priority: ${priority}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  await postSlackMessageOrFallback({
    channel: channelId,
    text: `✅ Task created for *${brandName}* by <@${userId}>: *${title}*${details ? ` (${details})` : ""}`,
  });

  return new Response("ok", { status: 200 });
};
