-- TikTok Shop Strategist Agent, Phase 1 (see plan doc) — per-brand Euka/Reacher identifiers.
-- Non-secret config, so plain columns on brands rather than the encrypted connections.tokens
-- blob — same precedent as slack_channel_id/google_sheet_id. All nullable: populated once a
-- brand's Euka account is actually connected.
alter table brands add column tiktok_euka_brand_id text;
alter table brands add column tiktok_euka_store_ids jsonb;
alter table brands add column tiktok_reacher_shop_id text;
alter table brands add column tiktok_plan_tier text check (tiktok_plan_tier in ('starter', 'growth'));

-- The per-brand strategy brief (SPEC: "house playbook + per-client learning" hybrid model) —
-- structured fields rather than freeform text, so a future agent can parse them reliably once it
-- starts drafting. One row per brand, replaced whole on save.
create table brand_strategy_briefs (
    brand_id          uuid primary key references brands(id) on delete cascade,
    icp               text,
    creator_profile   text,
    margin_targets    text,
    hero_skus         text,
    commission_range  text,
    message_templates text,
    daily_send_cap    integer,
    budget_ceiling    numeric,
    updated_by_id     uuid references users(id),
    updated_at        timestamptz not null default now()
);
