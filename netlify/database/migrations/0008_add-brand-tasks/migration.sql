-- Internal task tracker, one per brand — lives on the new internal brand hub
-- (/internal/brand/[brandId]). Not client-visible for now.
create table tasks (
    id          uuid primary key default gen_random_uuid(),
    brand_id    uuid not null references brands(id) on delete cascade,
    title       text not null,
    description text,
    status      text not null check (status in ('todo', 'in_progress', 'done')) default 'todo',
    assignee    text,
    due_date    date,
    created_by  uuid references users(id) on delete set null,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
create index tasks_brand_id_idx on tasks(brand_id);
