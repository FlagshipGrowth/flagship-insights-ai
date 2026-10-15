-- Recommendations surfaced by the scheduled Meta Ad Manager agent (performance callouts and
-- new creative it uploaded to Meta as paused, awaiting review) — shown on /internal/marketing.
create table if not exists agency_marketing_recommendations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  category text not null check (category in ('performance', 'creative')),
  title text not null,
  body text not null,
  meta_ref text,
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed'))
);

create index if not exists agency_marketing_recommendations_status_idx on agency_marketing_recommendations (status);
