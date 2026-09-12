-- Lets each brand be mapped to its own internal Slack channel, so /create-task run inside that
-- channel can resolve the brand automatically instead of requiring `client:<brand name>`.
-- Nullable + a partial unique index (not a plain unique constraint) so brands without a mapped
-- channel yet don't collide on NULL, and set via the internal brand hub UI, not a bulk seed here
-- -- unlike the reports.flagshipgrowth.com URLs, Joey's Slack channel IDs aren't something we can
-- look up or verify ourselves.
alter table brands add column slack_channel_id text;
create unique index brands_slack_channel_id_idx on brands(slack_channel_id) where slack_channel_id is not null;
