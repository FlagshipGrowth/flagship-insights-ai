-- Assigns the real person who owns each department's tasks per brand, from Joey's roster
-- (Account Manager / Ads Lead / Creative Assignment). Only fills `assignee` where it's
-- currently null — doesn't overwrite anything already set (e.g. the one onboarding task that
-- already has assignee = 'FSG'). "None"/"Not Assigned"/blank in the roster means no one is
-- assigned for that role yet, so those columns are simply omitted (null) rather than written as
-- a literal string.
--
-- Three brands in Joey's roster have no matching row here and are skipped entirely (flagged
-- back to him, not guessed at): "OpoPop (Walmart)" (Mufeez/Gabe/Travis — only one "Opopop" brand
-- exists, mapped to the "(Amazon)" row below since that's our only real row), "Natures Answer"
-- (Asad/NA/Louie), and "Paulina Fitness" (Hassan/—/Travis).

with roster (brand_name, account_manager, ads_lead, creative) as (
  values
    ('WINK', 'Vinny', null, null),
    ('Opopop', 'Shahrukh', 'Gabe', 'Travis'),
    ('TUBR', 'Shahrukh', 'Gabe', 'Travis'),
    ('Stogie Golf', 'Shahrukh', 'Shahrukh', null),
    ('MAC Energy', 'Shahrukh', 'Gabe', 'Travis'),
    ('SuperMush', 'Asad', 'Gabe', 'Travis'),
    ('Dormeo US', 'Shahrukh', 'Gabe', null),
    ('Dormeo CA', 'Shahrukh', 'Gabe', null),
    ('Smood Sweets', 'Shahrukh', 'Gabe', 'Travis'),
    ('Lewie', 'Asad', 'Gabe', 'Travis'),
    ('Reshoev8er US', 'Asad', 'Gabe', 'Travis'),
    ('Rationale Brewing', 'Asad', 'Gabe', 'Travis'),
    ('Aura House', 'Asad', 'Gabe', 'Louie'),
    ('Hapad', 'Asad', 'Gabe', 'Travis'),
    ('Heavenly Bodies', 'Asad', null, 'Travis'),
    ('Reshoev8er UK', 'Asad', 'Gabe', 'Travis'),
    ('Reshoev8er CA', 'Asad', 'Gabe', 'Louie'),
    ('Addasound', 'Asad', null, null),
    ('Be You Tiful Athletics', 'Asad', null, null),
    ('Sidekick', 'Shahrukh', 'Gabe', 'Travis'),
    ('Jax Athletics', 'Shahrukh', 'Gabe', 'Travis'),
    ('CaddyO', 'Asad', null, null),
    ('Noggin Boss', 'Shahrukh', null, null)
)
update tasks t
set assignee = r.account_manager
from roster r
join brands b on b.name = r.brand_name
where t.brand_id = b.id
  and t.team = 'Account Manager'
  and t.assignee is null
  and r.account_manager is not null;

with roster (brand_name, account_manager, ads_lead, creative) as (
  values
    ('WINK', 'Vinny', null, null),
    ('Opopop', 'Shahrukh', 'Gabe', 'Travis'),
    ('TUBR', 'Shahrukh', 'Gabe', 'Travis'),
    ('Stogie Golf', 'Shahrukh', 'Shahrukh', null),
    ('MAC Energy', 'Shahrukh', 'Gabe', 'Travis'),
    ('SuperMush', 'Asad', 'Gabe', 'Travis'),
    ('Dormeo US', 'Shahrukh', 'Gabe', null),
    ('Dormeo CA', 'Shahrukh', 'Gabe', null),
    ('Smood Sweets', 'Shahrukh', 'Gabe', 'Travis'),
    ('Lewie', 'Asad', 'Gabe', 'Travis'),
    ('Reshoev8er US', 'Asad', 'Gabe', 'Travis'),
    ('Rationale Brewing', 'Asad', 'Gabe', 'Travis'),
    ('Aura House', 'Asad', 'Gabe', 'Louie'),
    ('Hapad', 'Asad', 'Gabe', 'Travis'),
    ('Heavenly Bodies', 'Asad', null, 'Travis'),
    ('Reshoev8er UK', 'Asad', 'Gabe', 'Travis'),
    ('Reshoev8er CA', 'Asad', 'Gabe', 'Louie'),
    ('Addasound', 'Asad', null, null),
    ('Be You Tiful Athletics', 'Asad', null, null),
    ('Sidekick', 'Shahrukh', 'Gabe', 'Travis'),
    ('Jax Athletics', 'Shahrukh', 'Gabe', 'Travis'),
    ('CaddyO', 'Asad', null, null),
    ('Noggin Boss', 'Shahrukh', null, null)
)
update tasks t
set assignee = r.ads_lead
from roster r
join brands b on b.name = r.brand_name
where t.brand_id = b.id
  and t.team = 'Ads Team'
  and t.assignee is null
  and r.ads_lead is not null;

with roster (brand_name, account_manager, ads_lead, creative) as (
  values
    ('WINK', 'Vinny', null, null),
    ('Opopop', 'Shahrukh', 'Gabe', 'Travis'),
    ('TUBR', 'Shahrukh', 'Gabe', 'Travis'),
    ('Stogie Golf', 'Shahrukh', 'Shahrukh', null),
    ('MAC Energy', 'Shahrukh', 'Gabe', 'Travis'),
    ('SuperMush', 'Asad', 'Gabe', 'Travis'),
    ('Dormeo US', 'Shahrukh', 'Gabe', null),
    ('Dormeo CA', 'Shahrukh', 'Gabe', null),
    ('Smood Sweets', 'Shahrukh', 'Gabe', 'Travis'),
    ('Lewie', 'Asad', 'Gabe', 'Travis'),
    ('Reshoev8er US', 'Asad', 'Gabe', 'Travis'),
    ('Rationale Brewing', 'Asad', 'Gabe', 'Travis'),
    ('Aura House', 'Asad', 'Gabe', 'Louie'),
    ('Hapad', 'Asad', 'Gabe', 'Travis'),
    ('Heavenly Bodies', 'Asad', null, 'Travis'),
    ('Reshoev8er UK', 'Asad', 'Gabe', 'Travis'),
    ('Reshoev8er CA', 'Asad', 'Gabe', 'Louie'),
    ('Addasound', 'Asad', null, null),
    ('Be You Tiful Athletics', 'Asad', null, null),
    ('Sidekick', 'Shahrukh', 'Gabe', 'Travis'),
    ('Jax Athletics', 'Shahrukh', 'Gabe', 'Travis'),
    ('CaddyO', 'Asad', null, null),
    ('Noggin Boss', 'Shahrukh', null, null)
)
update tasks t
set assignee = r.creative
from roster r
join brands b on b.name = r.brand_name
where t.brand_id = b.id
  and t.team = 'Creative Team'
  and t.assignee is null
  and r.creative is not null;
