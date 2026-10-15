-- Seeds the outbound engine's do-not-contact list (2026-10-15). Three sources:
--   1. Joey's list of current/past clients and active conversations (names as given; channel
--      qualifiers like "(Amz)" / "(Wmt)" / "Roundel" stripped, plus known spelling variants, since
--      company matching is on the normalized name).
--   2. Warm leads found in Joey's sent mail (last 90 days) that weren't on that list: matched by
--      company name and by business email domain, or by exact address for gmail/yahoo senders.
--   3. Every lead already in the CRM, copied once by name and email. (Ingest also checks `leads`
--      live, so leads added later are excluded too; this just makes them visible on the list.)
-- `value` normalization matches lib/outbound.ts: company = lowercase alphanumerics, domain = bare
-- lowercase host, email = lowercase address.

insert into outbound_suppressions (kind, value, reason, created_by)
select 'company', lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')), reason, 'joey@flagshipgrowth.com'
from (values
    -- Current clients
    ('WINK', 'Client'), ('Carhartt', 'Client'), ('Dormeo', 'Client'), ('Dormeo US', 'Client'), ('Dormeo CA', 'Client'),
    ('SuperMush', 'Client'), ('Hapad', 'Client'), ('Reshoevn8r', 'Client'), ('Reshoev8er', 'Client'),
    ('MAC Energy', 'Client'), ('Lewie', 'Client'), ('Rationale Brewing', 'Client'), ('RationAle', 'Client'),
    ('Aura House', 'Client'), ('Noggin Boss', 'Client'), ('Heavenly Bodies', 'Client'), ('Heavenly Bodies Studio', 'Client'),
    ('Addasound', 'Client'), ('SideKick', 'Client'), ('SideKicks', 'Client'), ('SideKick Supplies', 'Client'), ('SideKicks Supplies', 'Client'),
    ('Opopop', 'Client'), ('BE-YOU-TIFUL Yoga', 'Client'), ('Be You Tiful', 'Client'), ('Be You Tiful Athletics', 'Client'),
    ('Natures Answer', 'Client'), ('Fruve', 'Client'), ('JAX Athletics', 'Client'), ('CaddyO', 'Client'),
    ('Paulina Fitness', 'Client'), ('Smood Sweets', 'Client'), ('TUBR', 'Client'), ('Tubr Storage', 'Client'),
    ('Stogie Golf', 'Client'), ('Good Bacteria', 'Client'), ('Zani Gummys', 'Client'), ('Zani Gummies', 'Client'), ('Zani', 'Client'),
    ('Energi Nutrition', 'Client'),
    -- Past clients / active conversations
    ('Sherpa Brands', 'Past client / conversation'), ('Sherpa Therapy', 'Past client / conversation'),
    ('Bateel', 'Past client / conversation'), ('Heali Medical', 'Past client / conversation'),
    ('Open Essentials', 'Past client / conversation'), ('Scotch Porter', 'Past client / conversation'),
    ('Verb', 'Past client / conversation'), ('Ramen Bae', 'Past client / conversation'), ('Vivandi', 'Past client / conversation'),
    ('Spritzi', 'Past client / conversation'), ('POW', 'Past client / conversation'),
    ('Station South Collective', 'Past client / conversation'), ('Empress', 'Past client / conversation'),
    ('Log Off Wellness', 'Past client / conversation'), ('BiteMeJerky', 'Past client / conversation'),
    ('Bite Me Jerky Co', 'Past client / conversation'), ('Kopo Pet', 'Past client / conversation'), ('Kopo', 'Past client / conversation'),
    ('TokenWorks', 'Past client / conversation'), ('Cob Foods', 'Past client / conversation'),
    ('Best Bodies 4 Lyfe', 'Past client / conversation'), ('Sophies Organics', 'Past client / conversation'),
    ('Brite-Glo', 'Past client / conversation'), ('Limitless X', 'Past client / conversation'),
    ('LUV Labs', 'Past client / conversation'), ('BRV Brands', 'Past client / conversation'),
    ('Supplement Xpress', 'Past client / conversation'), ('Miils', 'Past client / conversation'),
    ('Watts Wigs', 'Past client / conversation'), ('MeUndies', 'Past client / conversation'),
    ('Iron Outlaws', 'Past client / conversation'), ('Golden Tiger', 'Past client / conversation'),
    ('Palm Golf', 'Past client / conversation'), ('SavePod', 'Past client / conversation'), ('SavePods', 'Past client / conversation'),
    -- Warm leads from Joey's sent mail
    ('Superior Cloth and Stitch', 'Warm lead (email)'), ('Pathfinder Brands', 'Warm lead (email)'),
    ('Bon Appa Bev', 'Warm lead (email)'), ('Bio-Botanica', 'Warm lead (email)'),
    ('Warrior Kombucha', 'Warm lead (email)'), ('Warrior Recharge', 'Warm lead (email)'),
    ('Mitch', 'Warm lead (email)'), ('Valle Plateado', 'Warm lead (email)'), ('2nd Springs', 'Warm lead (email)'),
    ('Shaka Wear', 'Warm lead (email)'), ('Tofasco', 'Warm lead (email)'), ('Fantasy Fantasia', 'Warm lead (email)'),
    ('PARC', 'Warm lead (email)'), ('PARC Sport', 'Warm lead (email)'), ('Tantos', 'Warm lead (email)'),
    ('Tee Time Tees', 'Warm lead (email)'), ('MM Supply', 'Warm lead (email)'), ('OG Blend', 'Warm lead (email)'),
    ('Sly3', 'Warm lead (email)'), ('Digital Time Savers', 'Warm lead (email)')
) as t(name, reason)
on conflict (kind, value) do nothing;

insert into outbound_suppressions (kind, value, reason, created_by)
select 'domain', value, reason, 'joey@flagshipgrowth.com'
from (values
    ('superiorclothandstitch.com', 'Client (WINK/Carhartt)'), ('sgc.inc', 'Client (WINK/Carhartt)'),
    ('dormeo-na.com', 'Client'), ('supermush.com', 'Client'), ('reshoevn8r.com', 'Client'), ('drinkmac.com', 'Client'),
    ('pathfinderbrands.co', 'Client (Aura House)'), ('nogginboss.com', 'Client'), ('sidekicksupplies.com', 'Client'),
    ('opopop.com', 'Client'), ('naturesanswer.com', 'Client'), ('bio-botanica.com', 'Client (Natures Answer)'),
    ('bonappabev.com', 'Client (Fruve)'), ('jaxathletics.com', 'Client'), ('caddyo.com', 'Client'),
    ('tubrstorage.com', 'Client'), ('cpackmanufacturing.com', 'Client (Energi Nutrition)'),
    ('sherpabrands.com', 'Past client / conversation'), ('bateel.com', 'Past client / conversation'),
    ('tbd-ventures.com', 'Past client / conversation (Open Essentials)'), ('logoffwellness.com', 'Past client / conversation'),
    ('petlewa.com', 'Past client / conversation (Kopo)'), ('tokenworks.com', 'Past client / conversation'),
    ('cobfoods.com', 'Past client / conversation'), ('drinkmiils.com', 'Past client / conversation'),
    ('savepods.com', 'Past client / conversation'),
    ('drinkwarriorrecharge.com', 'Warm lead (email)'), ('mitch.com.mx', 'Warm lead (email)'),
    ('valleplateado.com', 'Warm lead (email)'), ('2ndsprings.com', 'Warm lead (email)'), ('shakawear.com', 'Warm lead (email)'),
    ('tofasco.com', 'Warm lead (email)'), ('parcsport.com', 'Warm lead (email)'), ('eattantos.com', 'Warm lead (email)'),
    ('teetimetees.golf', 'Warm lead (email)'), ('sly3game.com', 'Warm lead (email)'),
    ('digitaltimesavers.com', 'Warm lead (email)'),
    ('canopymanagement.com', 'Referral partner'), ('yellowmondaypartners.com', 'Referral partner')
) as t(value, reason)
on conflict (kind, value) do nothing;

insert into outbound_suppressions (kind, value, reason, created_by)
select 'email', value, reason, 'joey@flagshipgrowth.com'
from (values
    ('bitemejerkyco@gmail.com', 'Past client / conversation (Bite Me Jerky)'),
    ('jason_washington24@yahoo.com', 'Past client / conversation (Bite Me Jerky)'),
    ('donaldrayabbott@gmail.com', 'Client (Zani / Energi Nutrition)'),
    ('wbanta58@gmail.com', 'Client (Addasound)'),
    ('mmsupply786110@gmail.com', 'Warm lead (email)'),
    ('fantasyfantasia1@yahoo.com', 'Warm lead (email)'),
    ('ysm.trading.corp@gmail.com', 'Warm lead (email)')
) as t(value, reason)
on conflict (kind, value) do nothing;

-- Existing CRM leads.
insert into outbound_suppressions (kind, value, reason, created_by)
select distinct 'company', lower(regexp_replace(company_name, '[^a-zA-Z0-9]', '', 'g')), 'CRM lead', 'migration'
from leads
where regexp_replace(company_name, '[^a-zA-Z0-9]', '', 'g') <> ''
on conflict (kind, value) do nothing;

insert into outbound_suppressions (kind, value, reason, created_by)
select distinct 'email', lower(trim(email)), 'CRM lead', 'migration'
from leads
where email is not null and trim(email) <> ''
on conflict (kind, value) do nothing;
