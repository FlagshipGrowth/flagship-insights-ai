-- Backs the new /seo-listing Slack command (app/api/slack/commands/route.ts): a structured,
-- dedicated request for the Amazon SEO listing agent, distinct from a generic "SEO Team" task
-- (e.g. the onboarding checklist's placeholder "SEO Copy" task, which has no product/SKU/URL and
-- must NOT be picked up by anything watching for these). category = 'SEO Listing Request' is
-- what actually distinguishes the two, not team alone.
alter table tasks add column sku text;
alter table tasks add column product_url text;

-- The Slack message that requests the draft (posted by seo-listing-finalize-background.ts,
-- @-mentioning Claude Tag so it picks the request up automatically) — its ts, so
-- seo-listing-capture-reply-background.ts can match Claude Tag's threaded reply back to this
-- exact task when it arrives via the Slack Events API.
alter table tasks add column slack_thread_ts text;
