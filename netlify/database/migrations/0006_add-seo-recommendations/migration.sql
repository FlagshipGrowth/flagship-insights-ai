-- First real product tool: internal staff create SEO recommendations per brand, the
-- client reviews and approves/rejects them. Same auth split (internal vs client) as
-- everything else — no new roles needed.
create table seo_recommendations (
    id            uuid primary key default gen_random_uuid(),
    brand_id      uuid not null references brands(id) on delete cascade,
    title         text not null,
    category      text not null check (category in ('technical', 'on_page', 'content', 'keywords', 'backlinks', 'other')),
    description   text not null,
    priority      text not null check (priority in ('low', 'medium', 'high')) default 'medium',
    status        text not null check (status in ('pending', 'approved', 'rejected', 'implemented')) default 'pending',
    created_by    uuid references users(id) on delete set null,
    reviewed_by   uuid references users(id) on delete set null,
    client_comment text,
    created_at    timestamptz not null default now(),
    reviewed_at   timestamptz
);
create index seo_recommendations_brand_id_idx on seo_recommendations(brand_id);
