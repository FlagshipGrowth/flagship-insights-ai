-- Flagship Insights AI — initial warehouse schema (SPEC.md §4).
-- Applied via `netlify database migrations apply` — do not edit after it's applied;
-- once applied, changes go in a new migration (`netlify database migrations new`).
--
-- knowledge_chunks (SPEC.md §4/§7, pgvector-backed) is intentionally NOT in this migration:
-- it belongs to the knowledge-ingestion pipeline, which is Phase 4/5 and not in scope yet
-- (CLAUDE.md). Add it as its own migration when that phase starts.

create table clients (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    plan        text not null default 'standard',
    status      text not null default 'active',
    created_at  timestamptz not null default now()
);

create table brands (
    id               uuid primary key default gen_random_uuid(),
    client_id        uuid not null references clients(id) on delete cascade,
    name             text not null,
    channels_enabled text[] not null default '{}',
    created_at       timestamptz not null default now()
);
create index brands_client_id_idx on brands(client_id);

-- client_id is null for internal/Flagship staff accounts.
create table users (
    id          uuid primary key default gen_random_uuid(),
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
    id             uuid primary key default gen_random_uuid(),
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
    id          uuid primary key default gen_random_uuid(),
    brand_id    uuid not null references brands(id) on delete cascade,
    sku         text not null,
    source      text not null,
    quantity    integer not null,
    as_of_date  date not null,
    created_at  timestamptz not null default now()
);
create index inventory_snapshot_brand_sku_idx on inventory_snapshot(brand_id, sku, as_of_date);

-- source_refs / recommendations are stored as jsonb so the audit trail (which period,
-- which knowledge chunks) rides along with the insight rather than needing a join.
-- source_refs will reference knowledge_chunks.id once that table exists (Phase 4/5) —
-- no FK yet since the table doesn't exist.
create table insights (
    id               uuid primary key default gen_random_uuid(),
    brand_id         uuid not null references brands(id) on delete cascade,
    period           text not null,
    summary          text not null,
    recommendations  jsonb not null default '[]',
    source_refs      jsonb not null default '[]',
    created_at       timestamptz not null default now()
);
create index insights_brand_id_idx on insights(brand_id);
