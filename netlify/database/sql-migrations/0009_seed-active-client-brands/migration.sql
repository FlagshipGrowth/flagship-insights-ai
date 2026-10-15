-- Real active clients/brands, so internal staff can start using tools/tasks today without
-- waiting on each client to sign up. clerk_org_id stays null until each client creates their
-- own organization — the webhook (organization.created) links by matching name instead of
-- creating a duplicate once that happens. channels_enabled defaults to {amazon} as a
-- placeholder (matches the BB-Bands seed pattern) — correct per-brand if it's wrong.
with c as (
  insert into clients (name) values
    ('WINK'), ('Opopop'), ('TUBR'), ('Stogie Golf'), ('MAC Energy'), ('SuperMush'),
    ('Dormeo'), ('Smood Sweets'), ('Lewie'), ('Rationale Brewing'), ('Aura House'),
    ('Hapad'), ('Heavenly Bodies'), ('Reshoev8er'), ('Addasound'),
    ('Be You Tiful Athletics'), ('Sidekick'), ('Jax Athletics'), ('CaddyO'), ('Noggin Boss')
  returning id, name
)
insert into brands (client_id, name, channels_enabled)
select c.id, b.brand_name, array['amazon']
from c
join (values
  ('WINK', 'WINK'),
  ('Opopop', 'Opopop'),
  ('TUBR', 'TUBR'),
  ('Stogie Golf', 'Stogie Golf'),
  ('MAC Energy', 'MAC Energy'),
  ('SuperMush', 'SuperMush'),
  ('Dormeo', 'Dormeo US'),
  ('Dormeo', 'Dormeo CA'),
  ('Smood Sweets', 'Smood Sweets'),
  ('Lewie', 'Lewie'),
  ('Rationale Brewing', 'Rationale Brewing'),
  ('Aura House', 'Aura House'),
  ('Hapad', 'Hapad'),
  ('Heavenly Bodies', 'Heavenly Bodies'),
  ('Reshoev8er', 'Reshoev8er US'),
  ('Reshoev8er', 'Reshoev8er UK'),
  ('Reshoev8er', 'Reshoev8er CA'),
  ('Addasound', 'Addasound'),
  ('Be You Tiful Athletics', 'Be You Tiful Athletics'),
  ('Sidekick', 'Sidekick'),
  ('Jax Athletics', 'Jax Athletics'),
  ('CaddyO', 'CaddyO'),
  ('Noggin Boss', 'Noggin Boss')
) as b(client_name, brand_name) on b.client_name = c.name;
