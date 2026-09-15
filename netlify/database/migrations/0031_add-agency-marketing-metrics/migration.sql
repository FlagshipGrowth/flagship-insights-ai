-- Flagship's own marketing performance (Meta Ads today, more channels later) — not tied to any
-- client brand, so it doesn't belong in metrics_daily (which requires a non-null brand_id).
create table if not exists agency_marketing_metrics (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  date date not null,
  metric_key text not null,
  value numeric not null,
  created_at timestamptz not null default now(),
  unique (channel, date, metric_key)
);

create index if not exists agency_marketing_metrics_date_idx on agency_marketing_metrics (date);
