-- Sellerise integration (see plan doc) — per-brand mapping to a Sellerise account name +
-- marketplace. Non-secret config, same precedent as tiktok_euka_brand_id (0034): plain columns
-- on brands, not the encrypted connections.tokens blob.
alter table brands add column sellerise_account_name text;
alter table brands add column sellerise_marketplace text;

-- Brand-scoped, source-tagged generalization of agency_marketing_recommendations (0032, which is
-- agency-wide/Meta-specific) — for any per-brand agent's list-shaped findings (Sellerise first,
-- reusable by future ones). One row per finding, refreshed each sync rather than tracked open
-- indefinitely.
create table brand_recommendations (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references brands(id) on delete cascade,
  source      text not null,
  category    text not null,
  severity    text,
  title       text not null,
  body        text not null,
  meta_ref    text,
  status      text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at  timestamptz not null default now()
);

create index brand_recommendations_brand_id_idx on brand_recommendations(brand_id);
