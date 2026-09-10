-- First rows so the sync functions have a real brand_id to target. Fixed ids so this
-- stays idempotent if ever re-run outside the normal migration flow.
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
