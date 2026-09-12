import { getDb } from "./lib/db";
import { postSlackMessageOrFallback } from "./lib/slack";

// Runs after the "task_details_modal" (assignee/department/due date/priority) is submitted — see
// app/api/slack/interactions/route.ts's view_submission handling, which acks Slack (closing the
// modal) and fires this off rather than inserting inline, same 3-second-budget reasoning as the
// rest of this integration.
export default async (req: Request) => {
  const { title, brandId, brandName, assignee, team, dueDate, priority, userId, channelId } = (await req.json()) as {
    title: string;
    brandId: string;
    brandName: string;
    assignee: string | null;
    team: string | null;
    dueDate: string | null;
    priority: string | null;
    userId: string;
    channelId: string;
  };

  const sql = getDb();
  const description = "Created via Slack.";
  // "Anything inventory related is assigned to Sherilyn" — overrides whatever was typed into the
  // modal's Assignee field, same absolute rule enforced in lib/teams.ts's resolveAssignee() for
  // every other task-write path in the main app (this function is bundled standalone for Netlify
  // and can't import from there, so the rule is duplicated here).
  const resolvedAssignee = team === "Inventory Team" ? "Sherilyn" : assignee;
  await sql`
    insert into tasks (brand_id, title, description, assignee, team, priority, due_date)
    values (${brandId}, ${title}, ${description}, ${resolvedAssignee}, ${team}, ${priority}, ${dueDate})
  `;

  const details = [
    resolvedAssignee ? `assignee: ${resolvedAssignee}` : null,
    team ? `team: ${team}` : null,
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
