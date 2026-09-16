-- Brand-level monthly forecast-vs-actual data, pulled from each brand's Google Sheets "master
-- spec sheet" — specifically whichever tab title contains "Forecast" (e.g. "Forecast (Baseline)"),
-- following the same standard template seen across brands' sheets (see
-- netlify/functions/lib/catalog/google-sheets.ts). One row per (brand, year, month, metric) so a
-- month can be re-synced idempotently as actuals fill in through the year.
create table brand_forecasts (
    id          uuid primary key default gen_random_uuid(),
    brand_id    uuid not null references brands(id) on delete cascade,
    year        integer not null,
    month       integer not null check (month between 1 and 12),
    metric_key  text not null,
    value       numeric not null,
    synced_at   timestamptz not null default now(),
    unique (brand_id, year, month, metric_key)
);
create index brand_forecasts_brand_id_idx on brand_forecasts(brand_id);
