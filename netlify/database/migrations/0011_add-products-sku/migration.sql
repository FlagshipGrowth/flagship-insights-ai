-- Brands' spec sheets almost universally have their own internal SKU column, distinct from
-- ASIN — a human-readable identifier ("MAT-YOGA-BY-6MM-BLK", "CRYSTAL2731") that's what staff
-- and clients actually think in day to day, not the opaque ASIN. Needed for the item-level
-- margin calculator's product picker (see app/internal/brand/[brandId]/margin-calculator).
alter table products add column sku text;
