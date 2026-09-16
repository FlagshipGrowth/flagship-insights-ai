import { getDb } from "./lib/db";
import { postSlackMessage, postSlackMessageOrFallback } from "./lib/slack";

interface BulkRow {
  productName: string;
  sku: string | null;
  productUrl: string;
  priority: string | null;
}

// Slack's chat.postMessage text has a practical size limit, and a 50+ row batch listed in full
// (with URLs) can get close to it — cap what's inlined in the message; the task description
// (unbounded, on the dashboard) always carries every row regardless of batch size.
const MAX_ROWS_LISTED_IN_SLACK = 30;

// One task + one Slack thread for the WHOLE batch, not one per row (that flooded the channel
// with 2 messages per SKU — up to ~100 messages for a 50-SKU launch — and cluttered the
// dashboard with one task per product). Claude Tag still researches and Ranking-Juice-scores
// each product individually into the SEO-{Brand} sheet (per the amazon-seo-listing skill) — only
// the trigger message and the completion reply are consolidated to one per batch.
// seo-listing-capture-reply-background.ts matches by thread_ts, which is 1:1 with this one task,
// so however many times Claude Tag replies in this thread, it all logs onto this single task.
export default async (req: Request) => {
  const { brandId, brandName, channelId, requestedByName, rows } = (await req.json()) as {
    brandId: string;
    brandName: string;
    channelId: string;
    requestedByName: string;
    rows: BulkRow[];
  };

  const sql = getDb();
  const amRows = await sql`
    select u.email from users u
    join account_manager_assignments a on a.user_id = u.id
    join brands b on b.client_id = a.client_id
    where b.id = ${brandId}
  `;
  const accountManagerName =
    amRows.length > 0
      ? amRows.map((r: any) => {
          const local = String(r.email).split("@")[0] ?? "";
          return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase();
        }).join(", ")
      : null;

  const productCount = `${rows.length} product${rows.length === 1 ? "" : "s"}`;
  const description = `Bulk SEO upload (${productCount}), requested by ${requestedByName}.\n\n${rows
    .map((r, i) => `${i + 1}. ${r.productName} | SKU: ${r.sku ?? "not assigned yet"} | ${r.productUrl} | Priority: ${r.priority ?? "none"}`)
    .join("\n")}`;

  const inserted = await sql`
    insert into tasks (brand_id, title, description, category, team, status)
    values (${brandId}, ${`SEO listing bulk: ${productCount}`}, ${description}, 'SEO Listing Request', 'SEO Team', 'todo')
    returning id
  `;
  const taskId = inserted[0]?.id;

  const listedRows = rows.slice(0, MAX_ROWS_LISTED_IN_SLACK);
  const remaining = rows.length - listedRows.length;
  const productList = listedRows
    .map((r, i) => `${i + 1}. *${r.productName}* — SKU: ${r.sku ?? "not assigned yet"}${r.priority ? ` — Priority: ${r.priority}` : ""}`)
    .join("\n");

  const claudeMention = process.env.CLAUDE_TAG_SLACK_USER_ID ? `<@${process.env.CLAUDE_TAG_SLACK_USER_ID}> ` : "";
  const text = `📋 *New bulk SEO listing request* (via Flagship AI) for *${brandName}* — ${productCount} (task ${taskId}), requested by ${requestedByName}

${productList}${remaining > 0 ? `\n…and ${remaining} more (full list with website URLs is in task ${taskId}'s description on the dashboard).` : ""}

*Account manager:* ${accountManagerName ?? "none assigned in the system yet — mention this in your reply rather than guessing"}

${claudeMention}please run the amazon-seo-listing skill for each product above — research and draft each one individually into the SEO-${brandName} sheet — then reply once in this thread when the whole batch is done. Task ${taskId}.`;

  try {
    const result = await postSlackMessage({ channel: channelId, text, token: process.env.SLACK_USER_TOKEN });
    if (taskId) {
      await sql`update tasks set slack_thread_ts = ${result.ts} where id = ${taskId}`;
    }
    // Same immediate follow-up as seo-listing-finalize-background.ts — Claude Tag can silently
    // miss the original mention, so always send one extra nudge right away.
    if (claudeMention) {
      await postSlackMessage({
        channel: channelId,
        thread_ts: result.ts,
        text: `${claudeMention}following up on the request above — please pick this up now.`,
        token: process.env.SLACK_USER_TOKEN,
      }).catch((err) => console.error(`SEO listing bulk follow-up nudge failed: ${err instanceof Error ? err.message : err}`));
    }
  } catch (err) {
    await postSlackMessageOrFallback({ channel: channelId, text });
  }

  return new Response("ok", { status: 200 });
};
