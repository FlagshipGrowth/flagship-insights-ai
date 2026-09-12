-- Structured priority (low/med/high), promoted out of the free-text "Priority: X" line Slack
-- task creation folds into `description` — needed so the new per-person "My Tasks" dashboard can
-- rank by real priority instead of parsing text at read time. Backfilled from that same text for
-- tasks already created that way.
alter table tasks add column priority text check (priority in ('low', 'med', 'high'));

update tasks set priority = 'low' where priority is null and description ilike 'Priority: low%';
update tasks set priority = 'med' where priority is null and description ilike 'Priority: med%';
update tasks set priority = 'high' where priority is null and description ilike 'Priority: high%';

-- "Anything inventory related is assigned to Sherilyn" — an absolute rule, not a default, so
-- this overrides any assignee already on an Inventory Team task (none of migration 0022's roster
-- rows gave Inventory Team an assignee, so nothing real is actually overwritten in practice).
update tasks set assignee = 'Sherilyn' where team = 'Inventory Team';
