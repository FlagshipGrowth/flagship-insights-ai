import { getDb } from "./lib/db";
import { postSlackMessage, postSlackMessageOrFallback } from "./lib/slack";

interface BulkRow {
  productName: string;
  sku: string | null;
  productUrl: string;
  priority: string | null;
}

// Posting 50 Slack messages back-to-back risks Slack's per-channel rate limit — this is well
// under it (Slack's Tier 3 limit is roughly 1/sec sustained) while keeping the whole batch fast.
const DELAY_BETWEEN_POSTS_MS = 400;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Same per-product pipeline as seo-listing-finalize-background.ts (one task + one Slack thread
// per SKU — Claude Tag still needs to research and Ranking-Juice-score each product on its own,
// and seo-listing-capture-reply-background.ts matches replies back to a task by thread_ts, which
// only works 1:1), just looped for a CSV of many rows instead of one Slack modal submission. The
// per-task Slack reply itself is short ("task complete" style, not a full draft dump) per the
// amazon-seo-listing skill's Section 9 — the Google Sheet is the actual review surface, so this
// doesn't flood the channel with 50 long messages the way posting full drafts here would.
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

  const claudeMention = process.env.CLAUDE_TAG_SLACK_USER_ID ? `<@${process.env.CLAUDE_TAG_SLACK_USER_ID}> ` : "";
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const description = `Bulk SEO upload (row ${i + 1} of ${rows.length}), requested by ${requestedByName}.\nWebsite product page: ${row.productUrl}`;
      const inserted = await sql`
        insert into tasks (brand_id, title, description, category, team, sku, product_url, priority, status)
        values (${brandId}, ${`SEO listing: ${row.productName}`}, ${description}, 'SEO Listing Request', 'SEO Team',
                ${row.sku}, ${row.productUrl}, ${row.priority}, 'todo')
        returning id
      `;
      const taskId = inserted[0]?.id;

      const text = `📋 *New SEO listing request* (bulk upload via Flagship AI, ${i + 1}/${rows.length}) for *${brandName}* (task ${taskId})

*Product:* ${row.productName}
*SKU:* ${row.sku ?? "not assigned yet"}
*Website page:* ${row.productUrl}
*Priority:* ${row.priority ?? "none"}
*Account manager:* ${accountManagerName ?? "none assigned in the system yet — mention this in your reply rather than guessing"}

${claudeMention}please run the amazon-seo-listing skill for this product — task ${taskId}.`;

      try {
        const result = await postSlackMessage({ channel: channelId, text, token: process.env.SLACK_USER_TOKEN });
        if (taskId) {
          await sql`update tasks set slack_thread_ts = ${result.ts} where id = ${taskId}`;
        }
      } catch (err) {
        await postSlackMessageOrFallback({ channel: channelId, text });
      }
      succeeded++;
    } catch (err) {
      failed++;
      console.error(`seo-listing-bulk-background: row ${i + 1} (${row.productName}) failed: ${err}`);
    }

    if (i < rows.length - 1) await sleep(DELAY_BETWEEN_POSTS_MS);
  }

  await postSlackMessageOrFallback({
    channel: channelId,
    text: `✅ Bulk SEO upload for *${brandName}* done — ${succeeded} request${succeeded === 1 ? "" : "s"} queued above${failed > 0 ? `, ${failed} failed (check function logs)` : ""}.`,
  });

  return new Response("ok", { status: 200 });
};
