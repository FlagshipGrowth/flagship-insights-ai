-- Optional ASIN field on the /seo-listing modal (app/api/slack/commands/route.ts) — when a
-- product is already live, giving Claude Tag the ASIN directly means it can pull the live
-- listing's current keywords/rank/content itself (SKILL.md Section 3) instead of finding it.
alter table tasks add column asin text;
