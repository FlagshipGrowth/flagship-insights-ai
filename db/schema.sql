-- Flagship Insights AI — Phase 2 warehouse schema
-- Implements SPEC.md §4. Apply against the Netlify DB (Neon Postgres) instance:
--   psql "$DATABASE_URL" -f db/schema.sql
--
-- This is the first cut of the schema, not a migration history. Once this is applied for
-- real, switch to numbered migration files instead of editing this one in place.

create extension if not exists pgvector;
create extension if not exists "uuid-ossp";

create table clients (
    id          uuid primary key default uuid_generate_v4(),
    name        text not null,
    plan        text not null default 'standard',
    status      text not null default 'active',
    created_at  timestamptz not null default now()
);

create table brands (
    id               uuid primary key default uuid_generate_v4(),
    client_id        uuid not null references clients(id) on delete cascade,
    name             text not null,
    channels_enabled text[] not null default '{}',
    created_at       timestamptz not null default now()
);
create index brands_client_id_idx on brands(client_id);

-- client_id is null for internal/Flagship staff accounts.
create table users (
    id          uuid primary key default uuid_generate_v4(),
    client_id   uuid references clients(id) on delete cascade,
    role        text not null check (role in ('client_owner', 'client_teammate', 'account_manager', 'internal_admin')),
    email       text not null unique,
    created_at  timestamptz not null default now()
);
create index users_client_id_idx on users(client_id);

-- tokens are stored app-encrypted (envelope-encrypted before insert) — never plaintext.
-- Scheme: AES-256-GCM via netlify/functions/lib/crypto.ts (encryptToken/decryptToken),
-- called through lib/connections.ts — never insert/read this column directly.
create table connections (
    id             uuid primary key default uuid_generate_v4(),
    brand_id       uuid not null references brands(id) on delete cascade,
    channel        text not null,
    tokens         bytea not null,
    last_synced_at timestamptz,
    created_at     timestamptz not null default now(),
    unique (brand_id, channel)
);
create index connections_brand_id_idx on connections(brand_id);

-- Daily/MTD/YTD/Lifetime are all date-range filters against this table — no per-view special casing.
create table metrics_daily (
    brand_id    uuid not null references brands(id) on delete cascade,
    channel     text not null,
    date        date not null,
    metric_key  text not null,
    value       numeric not null,
    primary key (brand_id, channel, date, metric_key)
);
create index metrics_daily_brand_channel_date_idx on metrics_daily(brand_id, channel, date);

-- source is a free-text tag: 'amazon' | 'walmart' | a named 3PL | 'manual'.
create table inventory_snapshot (
    id          uuid primary key default uuid_generate_v4(),
    brand_id    uuid not null references brands(id) on delete cascade,
    sku         text not null,
    source      text not null,
    quantity    integer not null,
    as_of_date  date not null,
    created_at  timestamptz not null default now()
);
create index inventory_snapshot_brand_sku_idx on inventory_snapshot(brand_id, sku, as_of_date);

-- scope ∈ {'house', 'client'}. brand_id is null for house-tier chunks (shared across all clients).
-- Enforce at the retrieval layer, not just here: a client-tier query must always filter by brand_id.
create table knowledge_chunks (
    id          uuid primary key default uuid_generate_v4(),
    scope       text not null check (scope in ('house', 'client')),
    brand_id    uuid references brands(id) on delete cascade,
    source      text not null,
    content     text not null,
    embedding   vector(1536),
    created_at  timestamptz not null default now(),
    constraint client_scope_requires_brand check (scope = 'house' or brand_id is not null)
);
create index knowledge_chunks_brand_id_idx on knowledge_chunks(brand_id);
create index knowledge_chunks_embedding_idx on knowledge_chunks using ivfflat (embedding vector_cosine_ops);

-- source_refs / recommendations are stored as jsonb so the audit trail (which period,
-- which knowledge chunks) rides along with the insight rather than needing a join.
create table insights (
    id               uuid primary key default uuid_generate_v4(),
    brand_id         uuid not null references brands(id) on delete cascade,
    period           text not null,
    summary          text not null,
    recommendations  jsonb not null default '[]',
    source_refs      jsonb not null default '[]',
    created_at       timestamptz not null default now()
);
create index insights_brand_id_idx on insights(brand_id);
