-- Persists the item-level margin calculator's per-product inputs (app/internal/brand/[brandId]/
-- margin-calculator) across page loads via an explicit "Save" action — one row per product,
-- holding every field regardless of the FBA/FBM view toggle (that's a display concern only).
-- Anything not yet saved just falls back to the product's own msrp/cost_landed as a default.
create table margin_calculator_inputs (
    product_id        uuid primary key references products(id) on delete cascade,
    price             numeric,
    cogs              numeric,
    referral_pct      numeric,
    fba_fee           numeric,
    inbound           numeric,
    storage           numeric,
    fulfillment_cost  numeric,
    returns           numeric,
    ads_spend         numeric,
    updated_at        timestamptz not null default now()
);
