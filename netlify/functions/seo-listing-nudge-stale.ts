import type { Config } from "@netlify/functions";
import { getDb } from "./lib/db";
import { postSlackMessage } from "./lib/slack";

// Safety net for the /seo-listing → Claude Tag handoff: confirmed 2026-09-15 that Claude Tag can
// simply fail to pick up the original @-mention (no error, no reply — Claude Tag's own words when
// asked directly: "the request just didn't get picked up... there's no session on this thread").
// Rather than requiring a human to notice and manually re-mention it in the thread every time,
// re-nudge automatically once a request has sat untouched for a few minutes. Nudges at most once
// per task (seo_listing_nudged_at) — if a second nudge still doesn't get a reply, that's a real
// problem for a human to look at, not something to keep escalating on its own.
export default async () => {
  const sql = getDb();
  const staleTasks = await sql`
    select t.id, t.slack_thread_ts, b.slack_channel_id
    from tasks t
    join brands b on b.id = t.brand_id
    where t.category = 'SEO Listing Request'
      and t.status = 'todo'
      and t.slack_thread_ts is not null
      and t.seo_listing_nudged_at is null
      and t.created_at < now() - interval '3 minutes'
      and b.slack_channel_id is not null
  `;

  const claudeMention = process.env.CLAUDE_TAG_SLACK_USER_ID ? `<@${process.env.CLAUDE_TAG_SLACK_USER_ID}> ` : "";
  let nudged = 0;

  for (const task of staleTasks as any[]) {
    try {
      await postSlackMessage({
        channel: task.slack_channel_id,
        thread_ts: task.slack_thread_ts,
        text: `${claudeMention}following up on the request above — please pick this up now.`,
        token: process.env.SLACK_USER_TOKEN,
      });
      await sql`update tasks set seo_listing_nudged_at = now() where id = ${task.id}`;
      nudged++;
    } catch (err) {
      console.error(`Nudge failed for task ${task.id}: ${err instanceof Error ? err.message : err}`);
    }
  }

  return new Response(JSON.stringify({ checked: staleTasks.length, nudged }), { status: 200 });
};

export const config: Config = {
  schedule: "*/5 * * * *",
};
