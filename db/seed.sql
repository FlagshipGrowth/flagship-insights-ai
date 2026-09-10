-- First rows to seed once db/schema.sql has been applied — just enough for the sync
-- functions to have a real brand_id to target. Run after schema.sql:
--   psql "$DATABASE_URL" -f db/seed.sql
--
-- Uses a fixed client id so this file is idempotent (safe to re-run).
insert into clients (id, name, plan, status)
values ('00000000-0000-0000-0000-000000000001', 'BB-Bands', 'internal-test', 'active')
on conflict (id) do nothing;

insert into brands (id, client_id, name, channels_enabled)
values (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'BB-Bands',
    array['amazon']
)
on conflict (id) do nothing;
