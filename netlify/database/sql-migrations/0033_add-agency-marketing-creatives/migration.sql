-- Examples of the creative currently (or recently) running on Flagship's own Meta Ads account,
-- shown on /internal/marketing. Image bytes are stored directly (not the Meta CDN URL, which is
-- a signed link that expires within hours/days) and served back through our own image route.
create table if not exists agency_marketing_creatives (
  id uuid primary key default gen_random_uuid(),
  meta_creative_id text not null unique,
  ad_name text not null,
  headline text,
  body_copy text,
  status text not null,
  image_data bytea,
  image_content_type text,
  updated_at timestamptz not null default now()
);
