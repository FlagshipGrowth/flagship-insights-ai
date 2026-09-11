-- Catalog: product-level data synced live from each brand's Google Sheets "master spec
-- sheet" (Specs tab) — see netlify/functions/lib/catalog/google-sheets.ts. Core fields are
-- normalized (what SPEC's brand hub Catalog view needs); `raw` keeps whatever else the sheet
-- has so we don't lose fidelity across brands whose sheets were built by different people.
create table products (
    id              uuid primary key default gen_random_uuid(),
    brand_id        uuid not null references brands(id) on delete cascade,
    asin            text,
    title           text,
    status          text check (status in ('active', 'discontinued')),
    category        text,
    sub_category    text,
    product_type    text,
    upc             text,
    cost_landed     numeric,
    msrp            numeric,
    unit_weight     numeric,
    case_qty        integer,
    case_weight     numeric,
    case_length     numeric,
    case_width      numeric,
    case_height     numeric,
    raw             jsonb not null default '{}',
    last_synced_at  timestamptz,
    created_at      timestamptz not null default now(),
    unique (brand_id, asin)
);
create index products_brand_id_idx on products(brand_id);

-- Where to pull live data FROM for each brand. specs_gid is which tab within that
-- spreadsheet is the product Specs tab (defaults to the tab the tracker sheet's link
-- pointed at — verify per brand once sync is live; a couple were ambiguous, e.g. Noggin
-- Boss's link opened a status report, not a specs table).
alter table brands add column google_sheet_id text;
alter table brands add column google_sheet_specs_gid text;

update brands set google_sheet_id = '1xi-rTjwNBiauWuExB_aXcTYYp3fZ8lSgwzD6lUfveTc', google_sheet_specs_gid = '1465974138' where name = 'WINK';
update brands set google_sheet_id = '12-RB7fI_ns9XeVB755hn1TXnEbfml7EY6uSp9FXZUpk', google_sheet_specs_gid = '0' where name = 'Opopop';
update brands set google_sheet_id = '12jDj6wmD5f-NifkglxFOjjLloeQRczTec1_RsVobz9c', google_sheet_specs_gid = '0' where name = 'TUBR';
update brands set google_sheet_id = '1UePVjTXtFxrgPdqrxjqbIlQr5FxbzIiFGthTm2jviSw', google_sheet_specs_gid = '0' where name = 'Stogie Golf';
update brands set google_sheet_id = '1x3r_trppyzUmRtLgIuZGvvBP_yqY7hNZKUSsTYzP2bU', google_sheet_specs_gid = '0' where name = 'MAC Energy';
update brands set google_sheet_id = '1QhOxSay3SJSa-ACXzgrTKy9M0mLWNtNUVWuZ4-W47-w', google_sheet_specs_gid = '0' where name = 'SuperMush';
update brands set google_sheet_id = '1sGWhfSYwBfUFtjFvlPFQP8XM_UKQrbQibQlS5kMYY0o', google_sheet_specs_gid = '0' where name = 'Dormeo US';
update brands set google_sheet_id = '1d6l9-b3xpKkP2efsKhsE-fkmN8pcQmbcX_UNs8b2hfI', google_sheet_specs_gid = '0' where name = 'Dormeo CA';
update brands set google_sheet_id = '1-Kw9p-D3d_Ildt2GqT90XBlXDpc4rXd_L75nenvmi-4', google_sheet_specs_gid = '0' where name = 'Smood Sweets';
update brands set google_sheet_id = '1hzIVgbznrJDhJQZcyE8X55KIVg_z5pPJo7KFDKi1_s8', google_sheet_specs_gid = '0' where name = 'Lewie';
update brands set google_sheet_id = '1cUBB6sQB_cfbcmjEgzZ6LFlinObIQtL7_jbdreDNN48', google_sheet_specs_gid = '0' where name = 'Reshoev8er US';
update brands set google_sheet_id = '1b5Z5WKlKaEPW1KIyw4obtVNkHYw4hhkqgf1u6eI5d2Y', google_sheet_specs_gid = '0' where name = 'Rationale Brewing';
update brands set google_sheet_id = '1C9SOlKWZ9b_to1HM5bAN4XkYtJhYp0cVWd5E13eapBM', google_sheet_specs_gid = '0' where name = 'Aura House';
update brands set google_sheet_id = '11UDwRRn3mF0Bqg10Q_ch-x3Gty4BLSyteZO0D6YXqNg', google_sheet_specs_gid = '0' where name = 'Hapad';
update brands set google_sheet_id = '1sbF7gldCxenVCqOPzGwGmTYCDoqNM-4gw6nVN8ZJFEU', google_sheet_specs_gid = '0' where name = 'Heavenly Bodies';
update brands set google_sheet_id = '1-r1ZwahKKxy_MTScK7V-wpPEwf8k-liGnERvXmIXnB0', google_sheet_specs_gid = '0' where name = 'Reshoev8er UK';
update brands set google_sheet_id = '1jLdffquzzEll3gy8ViroqCPYWpMkbjWztt3kPDuFlNw', google_sheet_specs_gid = '0' where name = 'Reshoev8er CA';
update brands set google_sheet_id = '1aPZRL7fyYxxPqNuEHYqlvoXcXTVtbGN87KfYdA6fLd8', google_sheet_specs_gid = '0' where name = 'Addasound';
update brands set google_sheet_id = '1vVVaxnk8VJ-XRzJuihhgaFwk-nMpBbeXWrJ8ICW3j6s', google_sheet_specs_gid = '0' where name = 'Be You Tiful Athletics';
update brands set google_sheet_id = '1Y6cOgZU8G2g2bicLG9xGbbL0puaqaX1aOX5LnYpRTZ8', google_sheet_specs_gid = '0' where name = 'Sidekick';
update brands set google_sheet_id = '1P1Wbm7zUZZ2g35w8tYAdKw2QoHpdPH9Bs-qGJARsOJ0', google_sheet_specs_gid = '0' where name = 'Jax Athletics';
update brands set google_sheet_id = '1PyOisWXyLazhutfLMTZ2EgP4UPevM9EWRDkDiMccyTU', google_sheet_specs_gid = '0' where name = 'CaddyO';
update brands set google_sheet_id = '1iO0JCseX294ov9MGj513qdrtd7rE-wpgAUWkryvd0TI', google_sheet_specs_gid = '0' where name = 'Noggin Boss';
