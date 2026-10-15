-- Which internal team owns a task (distinct from `assignee`, a free-text person/org name).
-- Backs the per-team task counts on the new cross-brand admin task view.
alter table tasks add column team text
  check (team in ('Creative', 'Inventory', 'Ads', 'Customer Service', 'Catalog Team', 'Account Manager'));
create index tasks_team_idx on tasks(team);
