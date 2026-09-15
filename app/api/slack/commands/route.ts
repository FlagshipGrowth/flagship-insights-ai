import { verifySlackSignature, openSlackView } from "@/lib/slack";
import { getBrandBySlackChannelId } from "@/lib/brands";

export const runtime = "nodejs"; // needs Node's crypto — don't switch this to "edge"

const PRIORITY_OPTIONS = [
  { text: "Low", value: "low" },
  { text: "Medium", value: "med" },
  { text: "High", value: "high" },
];

/**
 * Handles Slack slash commands: `/create-task` and `/seo-listing`, both pointed at this same
 * Request URL (branching on the `command` field) rather than needing a separate URL per command.
 *
 * Slack app setup for a new command:
 *  1. api.slack.com/apps -> your app -> "Slash Commands" -> Create New Command
 *  2. Request URL: https://<netlify-domain>/api/slack/commands (same one for every command)
 *  3. Reinstall the app to the workspace to pick up the new command.
 *
 * `/create-task <conversational request>`
 *   e.g. "/create-task opopop needs their brand story rewritten, this is urgent" — Claude picks
 *   out the title, brand, and priority. Run inside a brand's own Slack channel (mapped via the
 *   internal brand hub's "Slack" section) and you don't even need to name the brand.
 *   Power-user shortcut: `/create-task <title> | client:<brand name> | priority:<low|med|high>`
 *   is still parsed deterministically (no LLM call) if you'd rather be explicit.
 *
 * `/seo-listing` — opens a modal for the Amazon SEO listing agent. Must be run in a brand's
 *   mapped Slack channel (no client: escape hatch — unlike /create-task this needs a real
 *   brandId before the modal can even open). The same modal covers both cases:
 *    - One product: fill in Product name / SKU / website URL / priority. Submitting creates a
 *      tracked task (see seo-listing-finalize-background.ts) and @-mentions Claude Tag with
 *      everything it needs to run the amazon-seo-listing skill and reply in that same thread.
 *    - Many products at once: use the "Download bulk CSV template" button, fill in one row per
 *      product, then attach the completed CSV via the file upload field below it — this skips
 *      the single-product fields and instead creates one task + one Slack thread per row (see
 *      seo-listing-bulk-background.ts), via the file_input Block Kit element. Requires the bot
 *      token to have the `files:write` scope (to accept an upload via that element at all) and
 *      `files:read` (for the interactions handler to download the file content afterward) —
 *      missing `files:write` specifically produces a hard-to-diagnose `invalid_arguments` on
 *      views.open, which without the try/catch below surfaced to users as Slack's generic "app
 *      did not respond" (confirmed 2026-09-14).
 *
 * `/seo-listing bulk` — a shortcut that skips the modal and replies ephemeral with a direct link
 *   to the same brand's Bulk SEO listing upload page on the dashboard, for anyone who'd rather
 *   review the queued batch there before/while it runs.
 */
const APP_URL = process.env.URL || "https://flagship-insights-ai.netlify.app";

function buildSeoListingModalView(brand: { id: string; name: string }, userId: string | null, channelId: string) {
  return {
    type: "modal",
    callback_id: "seo_listing_modal",
    private_metadata: JSON.stringify({ brandId: brand.id, brandName: brand.name, userId, channelId }),
    title: { type: "plain_text", text: "SEO listing request" },
    submit: { type: "plain_text", text: "Request" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `For *${brand.name}*` } },
      {
        type: "actions",
        block_id: "bulk_template_block",
        elements: [
          {
            type: "button",
            action_id: "download_bulk_template",
            text: { type: "plain_text", text: "📥 Download bulk CSV template" },
            url: `${APP_URL}/api/seo-listing/bulk-template`,
          },
        ],
      },
      {
        type: "input",
        block_id: "bulk_file_block",
        optional: true,
        label: { type: "plain_text", text: "Many SKUs? Upload a completed bulk CSV (skips the fields below)" },
        element: {
          type: "file_input",
          action_id: "bulk_file_input",
          filetypes: ["csv"],
          max_files: 1,
        },
      },
      { type: "divider" },
      {
        type: "input",
        block_id: "product_name_block",
        optional: true,
        label: { type: "plain_text", text: "Product name" },
        element: { type: "plain_text_input", action_id: "product_name_input" },
      },
      {
        type: "input",
        block_id: "sku_block",
        optional: true,
        label: { type: "plain_text", text: "SKU" },
        element: {
          type: "plain_text_input",
          action_id: "sku_input",
          placeholder: { type: "plain_text", text: "Leave blank if not assigned yet" },
        },
      },
      {
        type: "input",
        block_id: "product_url_block",
        optional: true,
        label: { type: "plain_text", text: "Website product page URL" },
        element: { type: "plain_text_input", action_id: "product_url_input" },
      },
      {
        type: "input",
        block_id: "priority_block",
        optional: true,
        label: { type: "plain_text", text: "Priority" },
        element: {
          type: "static_select",
          action_id: "priority_input",
          options: PRIORITY_OPTIONS.map((p) => ({
            text: { type: "plain_text", text: p.text },
            value: p.value,
          })),
        },
      },
    ],
  };
}

export async function POST(req: Request) {
  // Must read as raw text FIRST — verification depends on the exact raw bytes.
  const rawBody = await req.text();
  const timestamp = req.headers.get("x-slack-request-timestamp") ?? "";
  const signature = req.headers.get("x-slack-signature") ?? "";

  const isValid = verifySlackSignature({
    signingSecret: process.env.SLACK_SIGNING_SECRET ?? "",
    timestamp,
    rawBody,
    signature,
  });
  if (!isValid) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  const params = new URLSearchParams(rawBody);
  const command = params.get("command");
  const text = (params.get("text") ?? "").trim();
  const userId = params.get("user_id");
  const channelId = params.get("channel_id");
  const triggerId = params.get("trigger_id") ?? "";

  if (command === "/seo-listing") {
    if (!channelId) {
      return Response.json({ response_type: "ephemeral", text: "Couldn't read this channel." });
    }
    // A quick, single indexed lookup — not the "no DB" background-function dance /create-task
    // uses, since that's about avoiding slow/uncertain work (an LLM call, brand-name matching)
    // within Slack's 3s budget, not DB access itself. views.open also needs trigger_id used
    // immediately, so this whole command has to stay inline anyway.
    const brand = await getBrandBySlackChannelId(channelId);
    if (!brand) {
      return Response.json({
        response_type: "ephemeral",
        text: "This channel isn't mapped to a brand yet — set it on that brand's internal page under \"Slack\" first, then try again here.",
      });
    }

    if (text.toLowerCase() === "bulk") {
      return Response.json({
        response_type: "ephemeral",
        text: `📋 For many SKUs at once, use the bulk upload page: ${APP_URL}/internal/brand/${brand.id}/seo-bulk — download the CSV template there, fill in one row per product, and re-upload.`,
      });
    }

    try {
      await openSlackView({ trigger_id: triggerId, view: buildSeoListingModalView(brand, userId, channelId) });
    } catch (err) {
      // A crash here with no response is exactly what produces Slack's generic "app did not
      // respond" error (confirmed 2026-09-14 — invalid_arguments from views.open threw and this
      // route never returned anything within Slack's 3s budget). Always ack instead, with the
      // real Slack error surfaced so it's debuggable from the channel, not just function logs.
      console.error(`openSlackView failed for /seo-listing: ${err instanceof Error ? err.message : err}`);
      return Response.json({
        response_type: "ephemeral",
        text: `⚠️ Couldn't open the SEO listing form: ${err instanceof Error ? err.message : "unknown error"}`,
      });
    }

    // No JSON body here — the modal itself is the response. Response.json({}) previously sent a
    // literal "{}" body, which Slack rendered as a visible ephemeral message reading "{}".
    return new Response(null, { status: 200 });
  }

  if (command !== "/create-task") {
    return Response.json({ error: "Unknown command" }, { status: 400 });
  }

  if (!text) {
    return Response.json({
      response_type: "ephemeral",
      text: 'Usage: `/create-task <what needs to happen>` — e.g. "/create-task renew SEO copy for Opopop, high priority". Run in a brand\'s Slack channel and it names itself.',
    });
  }

  // Fire the background function and wait only for Netlify to accept the invocation (near-
  // instant — background functions return 202 immediately, before their own work finishes).
  // All real parsing (including the Claude call for conversational text) and brand resolution
  // happens over there, since it needs the DB and can take longer than Slack's 3s budget.
  await fetch(new URL("/.netlify/functions/slack-create-task-background", req.url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, userId, channelId }),
  });

  return Response.json({
    response_type: "ephemeral",
    text: `⏳ Creating task…`,
  });
}
