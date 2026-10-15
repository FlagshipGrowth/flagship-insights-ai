-- Joey's active warm-lead/deal list (2026-10-15), added to the CRM only where missing.
--
-- Each row has a match_key: a lead is "already there" if any existing lead's normalized
-- company_name starts with it. Single-deal brands use the bare brand name (so an existing
-- "Zani" or "Zani Gummies" lead both count); brands with several separate deals (Dormeo Walmart vs
-- Target, Natures Answer ads vs full management, ...) use the full deal label, since each is its own
-- opportunity even when a lead for the brand already exists.
--
-- HOT rows also flip is_hot on an existing matching lead; nothing else on an existing lead is
-- overwritten. Values are the monthly figure as given; extra terms go in notes. Rows with a
-- quoted price start at "proposal", the two without one at "qualified". Emails are only filled in
-- where Joey's own email threads show the address.

with input(company_name, match_key, contact_name, email, estimated_value, is_hot, stage, notes) as (
    values
    ('Zani Gummies', 'zani', null, 'donaldrayabbott@gmail.com', 2000, true, 'proposal', '$2,000'),
    ('Energi Nutrition', 'energi', null, 'kristen@cpackmanufacturing.com', 1500, true, 'proposal', '$1,500/mo + 5% of sales'),
    ('COB Foods', 'cobfoods', 'Nicki Pacheco', 'nicki@cobfoods.com', 3500, true, 'proposal', '$3,500'),
    ('Fruve', 'fruve', null, 'kevinf@bonappabev.com', 2000, true, 'proposal', '$2k/mo'),
    ('Natures Answer — Meta + Google Ads', 'naturesanswermetagoogleads', null, 'drussell@naturesanswer.com', 2750, true, 'qualified', 'Meta + Google Ads. No value given; $2,750 is the CRM placeholder.'),
    ('Rationale — Meta Ads', 'rationalemetaads', null, null, 1000, false, 'proposal', '$1,000/mo'),
    ('2nd Springs', '2ndsprings', 'Jon Ham', 'jon@2ndsprings.com', 3500, false, 'proposal', '$3,500'),
    ('Dormeo — Walmart', 'dormeowalmart', null, null, 3000, false, 'proposal', '$3,000'),
    ('Dormeo — Target', 'dormeotarget', null, null, 2000, false, 'proposal', '$2,000/mo'),
    ('Heavenly Bodies — UK Amazon', 'heavenlybodiesukamazon', null, null, 2500, false, 'proposal', '$2,500'),
    ('Reshoevn8r — MX management', 'reshoevn8rmxmanagement', null, null, 500, false, 'proposal', '$500/mo'),
    ('SuperMush — Ulta management', 'supermushultamanagement', null, null, 1000, false, 'proposal', '$1k/mo'),
    ('BiteMeJerky', 'bitemejerky', null, 'bitemejerkyco@gmail.com', 2500, false, 'proposal', '$2,500'),
    ('Kopo', 'kopo', 'Fatma / Recep', 'rcopur@petlewa.com', 2250, false, 'proposal', '$2,250'),
    ('TokenWorks', 'tokenworks', 'Daniel Greene', 'dang@tokenworks.com', 3000, false, 'proposal', '$3,000'),
    ('Beuta', 'beuta', 'Waqas Ahmad', null, 4000, false, 'proposal', '$4,000'),
    ('Cubivase', 'cubivase', null, null, 2000, false, 'proposal', '$2,000'),
    ('Miils', 'miils', null, 'cchoi@drinkmiils.com', 3000, false, 'proposal', '$3,000'),
    ('Natures Answer — Full Management', 'naturesanswerfullmanagement', null, 'drussell@naturesanswer.com', 2000, false, 'proposal', '$2,000'),
    ('Jonathan Shokrian Gummies', 'jonathanshokrian', 'Jonathan Shokrian', null, 2000, false, 'proposal', '$2,000'),
    ('RHO Nutrition', 'rhonutrition', 'Matt Schiffman', null, 3500, false, 'proposal', '$3,500'),
    ('NewDad', 'newdad', null, 'ier1@mac.com', 2750, false, 'qualified', 'No value given; $2,750 is the CRM placeholder.'),
    ('SavePod', 'savepod', 'Yianni', 'yianni@savepods.com', 3000, false, 'proposal', '$3,000'),
    ('Brixton — TikTok Shop', 'brixton', null, null, 4000, false, 'proposal', 'TikTok Shop, $4,000'),
    ('Tevra Brands', 'tevra', 'Tom Savage', null, 3500, false, 'proposal', '$3,500. Contact via LinkedIn.'),
    ('Shaka Wear', 'shakawear', 'Eugene Park / Amir', 'avejdani@shakawear.com', 5000, false, 'proposal', '$5,000. Eugene Park via LinkedIn.')
),
hot_existing as (
    update leads l set is_hot = true, updated_at = now()
    from input i
    where i.is_hot and not l.is_hot
      and lower(regexp_replace(l.company_name, '[^a-zA-Z0-9]', '', 'g')) like i.match_key || '%'
    returning l.id
)
insert into leads (company_name, contact_name, email, source, stage, estimated_value, notes, is_hot)
select i.company_name, i.contact_name, i.email, 'Joey''s warm-lead list', i.stage, i.estimated_value, i.notes, i.is_hot
from input i
where not exists (
    select 1 from leads l
    where lower(regexp_replace(l.company_name, '[^a-zA-Z0-9]', '', 'g')) like i.match_key || '%'
);
