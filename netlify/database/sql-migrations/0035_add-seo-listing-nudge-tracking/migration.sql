-- Tracks whether an automatic follow-up nudge has already been sent for a /seo-listing request
-- that Claude Tag hasn't picked up yet (see netlify/functions/seo-listing-nudge-stale.ts) — nudge
-- at most once per task, not on every scheduled run, so it doesn't spam the thread.
alter table tasks add column seo_listing_nudged_at timestamptz;
