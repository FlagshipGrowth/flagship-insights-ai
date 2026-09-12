import { getDb } from "./lib/db";

// Runs after app/api/slack/events/route.ts confirms a message is a threaded reply from Claude
// Tag itself. Matches it back to the /seo-listing task that started the thread (by
// tasks.slack_thread_ts) and logs it as a system activity entry — the same task_comments row
// every other status/team/due-date/priority change already rides on, so the draft shows up in
// the task's own history without Claude Tag needing any write-access to our database.
export default async (req: Request) => {
  const { channelId, threadTs, text } = (await req.json()) as {
    channelId: string;
    threadTs: string;
    text: string;
  };

  const sql = getDb();
  const rows = await sql`
    select t.id, t.status
    from tasks t
    join brands b on b.id = t.brand_id
    where t.slack_thread_ts = ${threadTs} and b.slack_channel_id = ${channelId} and t.category = 'SEO Listing Request'
  `;
  if (rows.length === 0) {
    // Not one of ours (or the thread_ts didn't match) — nothing to do.
    return new Response("ignored", { status: 200 });
  }

  const taskId = rows[0].id;
  const snippet = text.length > 3500 ? `${text.slice(0, 3500)}…` : text;
  await sql`
    insert into task_comments (task_id, author, body, is_system)
    values (${taskId}, 'Claude Tag', ${`posted a draft in Slack:\n\n${snippet}`}, true)
  `;
  if (rows[0].status === "todo") {
    await sql`update tasks set status = 'in_progress', updated_at = now() where id = ${taskId}`;
  }

  return new Response("ok", { status: 200 });
};
