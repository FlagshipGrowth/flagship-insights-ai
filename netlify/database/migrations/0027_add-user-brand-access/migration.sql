-- Grants a specific client user visibility into a brand, independent of brands.client_id (its
-- one owning client) — multiple users (potentially across different clients) can have access to
-- the same brand this way. Additive only: never changes a brand's actual client_id/ownership,
-- just who else can see it. Populated from the "Add Brand" picker in Manage Users
-- (app/internal/page.tsx) via lib/brand-access.ts; unioned into a client's own client_id-owned
-- brands in lib/metrics.ts's getBrandsForClient.
create table user_brand_access (
    user_id    uuid not null references users(id) on delete cascade,
    brand_id   uuid not null references brands(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, brand_id)
);
create index user_brand_access_brand_id_idx on user_brand_access(brand_id);
