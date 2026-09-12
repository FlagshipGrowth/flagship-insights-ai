-- Two more report types from reports.flagshipgrowth.com, alongside the weekly Sales/Ads report
-- (see migration 0013 and netlify/functions/lib/reports/). Only some brands have a
-- reconciliation report — checked each URL live rather than assuming the `-reconciliation`
-- slug pattern always exists (it doesn't for CaddyO, Hapad, Jax Athletics, Aura House, or
-- Heavenly Bodies).
alter table brands add column reconciliation_report_urls jsonb not null default '[]';

-- Per-SKU inventory snapshot, parsed from each brand's Inventory Report page's "FBA Inventory
-- Status" table. `region` disambiguates Hapad's US/Canada reports (both exist, one brand row);
-- it's a real empty string rather than null for single-region brands so the (brand_id, region,
-- asin) unique constraint actually dedupes on ON CONFLICT — Postgres treats every NULL as
-- distinct, which would silently break the upsert.
create table inventory_report_items (
    id              uuid primary key default gen_random_uuid(),
    brand_id        uuid not null references brands(id) on delete cascade,
    region          text not null default '',
    asin            text,
    sku             text,
    title           text,
    listing_status  text,
    fulfilled_by    text,
    total_stocks    numeric,
    available_fba   numeric,
    inbound         numeric,
    wkly_avg        numeric,
    l30_sold        numeric,
    weeks_left      numeric,
    synced_at       timestamptz not null default now(),
    unique (brand_id, region, asin)
);
create index inventory_report_items_brand_id_idx on inventory_report_items(brand_id);

-- Just the KPI summary from the Reconciliation Report (Value Recovered, Total Shipments,
-- Shipment Discrepancy, Cases Resolved) — one row per brand, latest snapshot only. No
-- per-region split needed: no brand with a reconciliation report has more than one.
create table reconciliation_summary (
    brand_id              uuid primary key references brands(id) on delete cascade,
    value_recovered       numeric,
    total_shipments       numeric,
    shipment_discrepancy  numeric,
    cases_resolved        numeric,
    synced_at             timestamptz not null default now()
);

update brands set reconciliation_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/opopop-reconciliation"}]' where name = 'Opopop';
update brands set reconciliation_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/dormeo-us-reconciliation"}]' where name = 'Dormeo US';
update brands set reconciliation_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/dormeo-canada-reconciliation"}]' where name = 'Dormeo CA';
update brands set reconciliation_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/lewie-reconciliation"}]' where name = 'Lewie';
update brands set reconciliation_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/reshoevn8r-us-reconciliation"}]' where name = 'Reshoev8er US';
update brands set reconciliation_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/reshoevn8r-canada-reconciliation"}]' where name = 'Reshoev8er CA';
update brands set reconciliation_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/reshoevn8r-uk-reconciliation"}]' where name = 'Reshoev8er UK';
update brands set reconciliation_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/tubr-storage-reconciliation"}]' where name = 'TUBR';
update brands set reconciliation_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/mac-energy-reconciliation"}]' where name = 'MAC Energy';
update brands set reconciliation_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/stogie-golf-reconciliation"}]' where name = 'Stogie Golf';
update brands set reconciliation_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/smood-sweets-reconciliation"}]' where name = 'Smood Sweets';
update brands set reconciliation_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/sidekick-reconciliation"}]' where name = 'Sidekick';
update brands set reconciliation_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/rationale-brewing-reconciliation"}]' where name = 'Rationale Brewing';
update brands set reconciliation_report_urls = '[{"label": null, "url": "https://reports.flagshipgrowth.com/supermush-reconciliation"}]' where name = 'SuperMush';
