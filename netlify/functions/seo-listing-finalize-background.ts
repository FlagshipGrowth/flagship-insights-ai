import { getDb } from "./lib/db";
import { postSlackMessage, postSlackMessageOrFallback } from "./lib/slack";

// Runs after the "seo_listing_modal" (product name/SKU/URL/priority) is submitted — see
// app/api/slack/interactions/route.ts's view_submission handling, same defer-to-background-
// function pattern as slack-finalize-task-background.ts, and for the same reason: acking Slack
// (closing the modal) can't wait on DB work within its 3-second budget.
export default async (req: Request) => {
  const { brandId, brandName, productName, sku, productUrl, priority, userId, channelId } = (await req.json()) as {
    brandId: string;
    brandName: string;
    productName: string;
    sku: string | null;
    productUrl: string;
    priority: string | null;
    userId: string;
    channelId: string;
  };

  const sql = getDb();
  const description = `Amazon SEO listing request.\nWebsite product page: ${productUrl}`;
  const inserted = await sql`
    insert into tasks (brand_id, title, description, category, team, sku, product_url, priority, status)
    values (${brandId}, ${`SEO listing: ${productName}`}, ${description}, 'SEO Listing Request', 'SEO Team',
            ${sku}, ${productUrl}, ${priority}, 'todo')
    returning id
  `;
  const taskId = inserted[0]?.id;

  // Claude Tag has no access to our DB/internal portal, so it can't look up the account manager
  // itself the way the skill's written instructions describe — resolve it here and hand over a
  // name instead. firstname@flagshipgrowth.com -> "Firstname", same convention the rest of the
  // app derives a person's display name from (see lib/user-context.ts's deriveNameFromEmail).
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

  // The one message Claude Tag actually acts on — everything it needs is right here, so nobody
  // has to type anything to Claude Tag directly. CLAUDE_TAG_SLACK_USER_ID is set once Claude Tag
  // is invited to the workspace (see CLAUDE.md); without it this still posts, just without the
  // mention, so Claude Tag won't pick it up automatically until that's configured.
  //
  // Posted with SLACK_USER_TOKEN, not the bot token: confirmed 2026-09-14 that Claude Tag only
  // reacts to @-mentions in messages with a real user_id and no bot_id — a bot-posted mention got
  // zero response. Using the user token makes this a genuine human-authored message (it'll show
  // as posted by whoever authorized that token), so the "(via Flagship AI)" tag below is there so
  // that's not confusing to anyone reading the channel.
  const claudeMention = process.env.CLAUDE_TAG_SLACK_USER_ID ? `<@${process.env.CLAUDE_TAG_SLACK_USER_ID}> ` : "";
  const text = `📋 *New SEO listing request* (via Flagship AI) for *${brandName}* (task ${taskId}), requested by <@${userId}>

*Product:* ${productName}
*SKU:* ${sku ?? "not assigned yet"}
*Website page:* ${productUrl}
*Priority:* ${priority ?? "none"}
*Account manager:* ${accountManagerName ?? "none assigned in the system yet — mention this in your reply rather than guessing"}

${claudeMention}please run the amazon-seo-listing skill for this product and reply in this thread with the draft (Title A/B, Item Highlights, Bullets, Backend Search Terms, Ranking Juice) — task ${taskId}.`;

  try {
    const result = await postSlackMessage({ channel: channelId, text, token: process.env.SLACK_USER_TOKEN });
    if (taskId) {
      await sql`update tasks set slack_thread_ts = ${result.ts} where id = ${taskId}`;
    }
    // Confirmed 2026-09-15: Claude Tag can silently fail to pick up this exact mention (no error,
    // no reply — its own words when asked directly: "the request just didn't get picked up").
    // Always send one immediate follow-up in the same thread rather than waiting to find out —
    // cheap, and doubles the chance one of the two mentions actually lands.
    if (claudeMention) {
      await postSlackMessage({
        channel: channelId,
        thread_ts: result.ts,
        text: `${claudeMention}following up on the request above — please pick this up now.`,
        token: process.env.SLACK_USER_TOKEN,
      }).catch((err) => console.error(`SEO listing follow-up nudge failed: ${err instanceof Error ? err.message : err}`));
    }
  } catch (err) {
    // Same fallback as everywhere else in this integration — post the failure where a human will
    // actually see it rather than losing it silently. Posts as the bot (not the user token) since
    // it's just an ops alert, not something that needs Claude Tag's attention. No thread_ts to
    // save in this path, so seo-listing-capture-reply-background.ts won't have anything to match
    // a reply against; the task itself (and this alert) are still the record the request happened.
    await postSlackMessageOrFallback({ channel: channelId, text });
  }

  return new Response("ok", { status: 200 });
};
