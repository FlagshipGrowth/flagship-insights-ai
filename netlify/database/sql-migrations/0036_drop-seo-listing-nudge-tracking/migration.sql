-- Reverts 0035: switched from a scheduled staleness-poller (checked every 5 minutes) to always
-- sending one immediate follow-up right after the trigger message — no polling, no state to track.
alter table tasks drop column seo_listing_nudged_at;
