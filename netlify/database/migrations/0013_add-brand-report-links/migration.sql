-- External weekly Sales/Ads and Inventory report dashboards (reports.flagshipgrowth.com),
-- refreshed by Joey's own pipeline every Monday/Tuesday — we just link to them live, nothing
-- to sync. jsonb array of {label, url} rather than a plain text column because Hapad has two
-- reports (US + Canada) under one brand row; label is null where the brand's own name already
-- carries the region (e.g. "Dormeo US").
alter table brands add column weekly_report_urls jsonb not null default '[]';
alter table brands add column inventory_report_urls jsonb not null default '[]';

update brands set
  weekly_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/dormeo-us-weekly"}]',
  inventory_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/dormeo-us-inventory"}]'
where name = 'Dormeo US';

update brands set
  weekly_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/dormeo-canada-weekly"}]',
  inventory_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/dormeo-canada-inventory"}]'
where name = 'Dormeo CA';

update brands set
  weekly_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/opopop-weekly"}]',
  inventory_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/opopop-inventory"}]'
where name = 'Opopop';

-- The brand's own spec sheet/reporting is spelled "Reshoevn8r" — our seed migration (0009)
-- typo'd it as "Reshoev8er". Matching by our existing (typo'd) name here rather than renaming
-- the brand rows, to avoid a wider rename touching tasks/margin data/etc — flagged for Joey.
update brands set
  weekly_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/reshoevn8r-us-weekly"}]',
  inventory_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/reshoevn8r-us-inventory"}]'
where name = 'Reshoev8er US';

update brands set
  weekly_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/reshoevn8r-canada-weekly"}]',
  inventory_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/reshoevn8r-canada-inventory"}]'
where name = 'Reshoev8er CA';

update brands set
  weekly_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/reshoevn8r-uk-weekly"}]',
  inventory_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/reshoevn8r-uk-inventory"}]'
where name = 'Reshoev8er UK';

-- Hapad is a single brand row here but has separate US/Canada reports — both attached with
-- labels so the UI can tell them apart.
update brands set
  weekly_report_urls = '[
    {"label": "US", "url": "https://reports.flagshipgrowth.com/hapad-us-weekly"},
    {"label": "Canada", "url": "https://reports.flagshipgrowth.com/hapad-canada-weekly"}
  ]',
  inventory_report_urls = '[
    {"label": "US", "url": "https://reports.flagshipgrowth.com/hapad-us-inventory"},
    {"label": "Canada", "url": "https://reports.flagshipgrowth.com/hapad-canada-inventory"}
  ]'
where name = 'Hapad';

update brands set
  weekly_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/supermush-weekly"}]',
  inventory_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/supermush-inventory"}]'
where name = 'SuperMush';

update brands set
  weekly_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/rationale-brewing-weekly"}]',
  inventory_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/rationale-brewing-inventory"}]'
where name = 'Rationale Brewing';

-- Listed as "Tubr Storage" in the report links — same brand as our "TUBR".
update brands set
  weekly_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/tubr-storage-weekly"}]',
  inventory_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/tubr-storage-inventory"}]'
where name = 'TUBR';

update brands set
  weekly_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/stogie-golf-weekly"}]',
  inventory_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/stogie-golf-inventory"}]'
where name = 'Stogie Golf';

update brands set
  weekly_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/mac-energy-weekly"}]',
  inventory_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/mac-energy-inventory"}]'
where name = 'MAC Energy';

update brands set
  weekly_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/smood-sweets-weekly"}]',
  inventory_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/smood-sweets-inventory"}]'
where name = 'Smood Sweets';

update brands set
  weekly_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/lewie-weekly"}]',
  inventory_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/lewie-inventory"}]'
where name = 'Lewie';

update brands set
  weekly_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/sidekick-weekly"}]',
  inventory_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/sidekick-inventory"}]'
where name = 'Sidekick';

update brands set
  weekly_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/jax-athletics-weekly"}]',
  inventory_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/jax-athletics-inventory"}]'
where name = 'Jax Athletics';

update brands set
  weekly_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/aura-house-weekly"}]',
  inventory_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/aura-house-inventory"}]'
where name = 'Aura House';

update brands set
  weekly_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/heavenly-bodies-weekly"}]',
  inventory_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/heavenly-bodies-inventory"}]'
where name = 'Heavenly Bodies';

update brands set
  weekly_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/caddyo-weekly"}]',
  inventory_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/caddyo-inventory"}]'
where name = 'CaddyO';
