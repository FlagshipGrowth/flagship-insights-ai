-- Seeds the outbound engine's do-not-contact list (2026-10-15), bucketed by category:
--   client           Joey's current-client list (channel qualifiers like "(Amz)" / "(Wmt)" /
--                    "Roundel" stripped, known spelling variants added, since company matching is
--                    on the normalized name).
--   client_parent    Parent/operating companies behind those clients, by name and email domain.
--   past_client      The second half of Joey's list (past clients / older conversations).
--   warm_lead        Brands in active sales conversations: from Joey's warm-lead list (also added
--                    to the CRM in 0041) and from his sent mail (last 90 days).
--   referral_partner Agencies/partners that send us leads.
--   crm_lead         A one-time copy of every CRM lead's name and email. (Ingest also checks
--                    `leads` live, so leads added later are excluded too; this makes them visible.)
-- `value` normalization matches lib/outbound.ts: company = lowercase alphanumerics, domain = bare
-- lowercase host, email = lowercase address. Every category blocks outreach the same way.

insert into outbound_suppressions (kind, value, category, reason, created_by)
select 'company', lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')), category, reason, 'joey@flagshipgrowth.com'
from (values
    -- Current clients
    ('WINK', 'client', null), ('Carhartt', 'client', null), ('Dormeo', 'client', null), ('Dormeo US', 'client', null),
    ('Dormeo CA', 'client', null), ('SuperMush', 'client', null), ('Hapad', 'client', null),
    ('Reshoevn8r', 'client', null), ('Reshoev8er', 'client', null), ('MAC Energy', 'client', null), ('Lewie', 'client', null),
    ('Rationale Brewing', 'client', null), ('RationAle', 'client', null), ('Aura House', 'client', null),
    ('Noggin Boss', 'client', null), ('Heavenly Bodies', 'client', null), ('Heavenly Bodies Studio', 'client', null),
    ('Addasound', 'client', null), ('SideKick', 'client', null), ('SideKicks', 'client', null),
    ('SideKick Supplies', 'client', null), ('SideKicks Supplies', 'client', null), ('Opopop', 'client', null),
    ('BE-YOU-TIFUL Yoga', 'client', null), ('Be You Tiful', 'client', null), ('Be You Tiful Athletics', 'client', null),
    ('Natures Answer', 'client', null), ('Fruve', 'client', null), ('JAX Athletics', 'client', null),
    ('CaddyO', 'client', null), ('Paulina Fitness', 'client', null), ('Smood Sweets', 'client', null),
    ('TUBR', 'client', null), ('Tubr Storage', 'client', null), ('Stogie Golf', 'client', null),
    ('Good Bacteria', 'client', null), ('Zani Gummys', 'client', null), ('Zani Gummies', 'client', null),
    ('Zani', 'client', null), ('Energi Nutrition', 'client', null),
    -- Parent companies of clients
    ('Superior Cloth and Stitch', 'client_parent', 'WINK / Carhartt'), ('SGC', 'client_parent', 'WINK / Carhartt'),
    ('Pathfinder Brands', 'client_parent', 'Aura House'), ('Bon Appa Bev', 'client_parent', 'Fruve'),
    ('Bio-Botanica', 'client_parent', 'Natures Answer'), ('CPack Manufacturing', 'client_parent', 'Energi Nutrition'),
    -- Past clients / older conversations
    ('Sherpa Brands', 'past_client', null), ('Sherpa Therapy', 'past_client', null), ('Bateel', 'past_client', null),
    ('Heali Medical', 'past_client', null), ('Open Essentials', 'past_client', null), ('Scotch Porter', 'past_client', null),
    ('Verb', 'past_client', null), ('Ramen Bae', 'past_client', null), ('Vivandi', 'past_client', null),
    ('Spritzi', 'past_client', null), ('POW', 'past_client', null), ('Station South Collective', 'past_client', null),
    ('Empress', 'past_client', null), ('Log Off Wellness', 'past_client', null),
    ('Best Bodies 4 Lyfe', 'past_client', null), ('Sophies Organics', 'past_client', null),
    ('Brite-Glo', 'past_client', null), ('Limitless X', 'past_client', null), ('LUV Labs', 'past_client', null),
    ('BRV Brands', 'past_client', null), ('Supplement Xpress', 'past_client', null), ('Watts Wigs', 'past_client', null),
    ('MeUndies', 'past_client', null), ('Iron Outlaws', 'past_client', null), ('Golden Tiger', 'past_client', null),
    ('Palm Golf', 'past_client', null),
    -- Warm leads: Joey's warm-lead list
    ('COB Foods', 'warm_lead', 'Warm-lead list'), ('BiteMeJerky', 'warm_lead', 'Warm-lead list'),
    ('Bite Me Jerky Co', 'warm_lead', 'Warm-lead list'), ('Kopo', 'warm_lead', 'Warm-lead list'),
    ('Kopo Pet', 'warm_lead', 'Warm-lead list'), ('TokenWorks', 'warm_lead', 'Warm-lead list'),
    ('Beuta', 'warm_lead', 'Warm-lead list'), ('Cubivase', 'warm_lead', 'Warm-lead list'),
    ('Miils', 'warm_lead', 'Warm-lead list'), ('Jonathan Shokrian Gummies', 'warm_lead', 'Warm-lead list'),
    ('RHO Nutrition', 'warm_lead', 'Warm-lead list'), ('NewDad', 'warm_lead', 'Warm-lead list'),
    ('SavePod', 'warm_lead', 'Warm-lead list'), ('SavePods', 'warm_lead', 'Warm-lead list'),
    ('Brixton', 'warm_lead', 'Warm-lead list'), ('Tevra Brands', 'warm_lead', 'Warm-lead list'),
    ('2nd Springs', 'warm_lead', 'Warm-lead list'), ('Shaka Wear', 'warm_lead', 'Warm-lead list'),
    -- Warm leads: from Joey's sent mail
    ('Warrior Kombucha', 'warm_lead', 'Sent mail'), ('Warrior Recharge', 'warm_lead', 'Sent mail'),
    ('Mitch', 'warm_lead', 'Sent mail (Amazon Accelerate)'), ('Valle Plateado', 'warm_lead', 'Sent mail (Amazon Accelerate)'),
    ('Tofasco', 'warm_lead', 'Sent mail'), ('Fantasy Fantasia', 'warm_lead', 'Sent mail'),
    ('PARC', 'warm_lead', 'Sent mail'), ('PARC Sport', 'warm_lead', 'Sent mail'), ('Tantos', 'warm_lead', 'Sent mail'),
    ('Tee Time Tees', 'warm_lead', 'Sent mail'), ('MM Supply', 'warm_lead', 'Sent mail'),
    ('OG Blend', 'warm_lead', 'Sent mail'), ('YSM Trading', 'warm_lead', 'Sent mail'), ('Sly3', 'warm_lead', 'Sent mail'),
    ('Digital Time Savers', 'warm_lead', 'Sent mail'),
    -- Referral partners
    ('Canopy Management', 'referral_partner', null), ('Yellow Monday Partners', 'referral_partner', null)
) as t(name, category, reason)
on conflict (kind, value) do nothing;

insert into outbound_suppressions (kind, value, category, reason, created_by)
select 'domain', value, category, reason, 'joey@flagshipgrowth.com'
from (values
    ('dormeo-na.com', 'client', 'Dormeo'), ('supermush.com', 'client', 'SuperMush'), ('reshoevn8r.com', 'client', 'Reshoevn8r'),
    ('drinkmac.com', 'client', 'MAC Energy'), ('nogginboss.com', 'client', 'Noggin Boss'),
    ('sidekicksupplies.com', 'client', 'SideKick'), ('opopop.com', 'client', 'Opopop'),
    ('naturesanswer.com', 'client', 'Natures Answer'), ('jaxathletics.com', 'client', 'JAX Athletics'),
    ('caddyo.com', 'client', 'CaddyO'), ('tubrstorage.com', 'client', 'TUBR'),
    ('superiorclothandstitch.com', 'client_parent', 'WINK / Carhartt'), ('sgc.inc', 'client_parent', 'WINK / Carhartt'),
    ('pathfinderbrands.co', 'client_parent', 'Aura House'), ('bonappabev.com', 'client_parent', 'Fruve'),
    ('bio-botanica.com', 'client_parent', 'Natures Answer'), ('cpackmanufacturing.com', 'client_parent', 'Energi Nutrition'),
    ('sherpabrands.com', 'past_client', 'Sherpa'), ('bateel.com', 'past_client', 'Bateel'),
    ('tbd-ventures.com', 'past_client', 'Open Essentials'), ('logoffwellness.com', 'past_client', 'Log Off Wellness'),
    ('cobfoods.com', 'warm_lead', 'COB Foods'), ('petlewa.com', 'warm_lead', 'Kopo'), ('tokenworks.com', 'warm_lead', 'TokenWorks'),
    ('drinkmiils.com', 'warm_lead', 'Miils'), ('savepods.com', 'warm_lead', 'SavePod'),
    ('2ndsprings.com', 'warm_lead', '2nd Springs'), ('shakawear.com', 'warm_lead', 'Shaka Wear'),
    ('drinkwarriorrecharge.com', 'warm_lead', 'Warrior Kombucha'), ('mitch.com.mx', 'warm_lead', 'Mitch'),
    ('valleplateado.com', 'warm_lead', 'Valle Plateado'), ('tofasco.com', 'warm_lead', 'Tofasco'),
    ('parcsport.com', 'warm_lead', 'PARC'), ('eattantos.com', 'warm_lead', 'Tantos'),
    ('teetimetees.golf', 'warm_lead', 'Tee Time Tees'), ('sly3game.com', 'warm_lead', 'Sly3'),
    ('digitaltimesavers.com', 'warm_lead', 'Digital Time Savers'),
    ('canopymanagement.com', 'referral_partner', 'Canopy Management'),
    ('yellowmondaypartners.com', 'referral_partner', 'Yellow Monday Partners')
) as t(value, category, reason)
on conflict (kind, value) do nothing;

-- Personal-domain addresses (gmail/yahoo/mac) are suppressed by exact address, never by domain.
insert into outbound_suppressions (kind, value, category, reason, created_by)
select 'email', value, category, reason, 'joey@flagshipgrowth.com'
from (values
    ('donaldrayabbott@gmail.com', 'client', 'Zani / Energi Nutrition'),
    ('wbanta58@gmail.com', 'client', 'Addasound'),
    ('bitemejerkyco@gmail.com', 'warm_lead', 'BiteMeJerky'),
    ('jason_washington24@yahoo.com', 'warm_lead', 'BiteMeJerky'),
    ('ier1@mac.com', 'warm_lead', 'NewDad'),
    ('mmsupply786110@gmail.com', 'warm_lead', 'MM Supply'),
    ('fantasyfantasia1@yahoo.com', 'warm_lead', 'Fantasy Fantasia'),
    ('ysm.trading.corp@gmail.com', 'warm_lead', 'YSM Trading')
) as t(value, category, reason)
on conflict (kind, value) do nothing;

-- Every CRM lead (including the ones 0041 just added). Brands already listed above keep their
-- more specific category.
insert into outbound_suppressions (kind, value, category, reason, created_by)
select distinct 'company', lower(regexp_replace(company_name, '[^a-zA-Z0-9]', '', 'g')), 'crm_lead', company_name, 'migration'
from leads
where regexp_replace(company_name, '[^a-zA-Z0-9]', '', 'g') <> ''
on conflict (kind, value) do nothing;

insert into outbound_suppressions (kind, value, category, reason, created_by)
select distinct 'email', lower(trim(email)), 'crm_lead', null, 'migration'
from leads
where email is not null and trim(email) <> ''
on conflict (kind, value) do nothing;
