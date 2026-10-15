-- Closes the SPEC.md §2 open item: account_manager scope is "assigned clients", not every
-- client (that's internal_admin). Many-to-many since a manager can cover several clients.
create table account_manager_assignments (
    user_id    uuid not null references users(id) on delete cascade,
    client_id  uuid not null references clients(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, client_id)
);
