-- Flagship's own new-business sales pipeline (Admin View only, per SPEC's original three-tier
-- access plan) — entirely separate from `clients`/`brands`, which are actual Flagship customers.
-- A won lead isn't auto-converted into a client; that's still a manual sign-up/approval like any
-- other, at least for now.
create table leads (
    id               uuid primary key default gen_random_uuid(),
    company_name     text not null,
    contact_name     text,
    email            text,
    phone            text,
    source           text,
    stage            text not null check (stage in ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost')) default 'new',
    estimated_value  numeric,
    notes            text,
    assigned_to_id   uuid references users(id) on delete set null,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);
create index leads_stage_idx on leads(stage);
