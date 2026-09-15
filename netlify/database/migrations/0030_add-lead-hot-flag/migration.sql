-- A manually-toggled "hot lead" flag (🔥 in the UI) — just a visual priority marker, not tied to
-- stage. $2,750 is the new default estimated value for a lead with none given (a placeholder
-- per-brand value, not a real estimate) — backfills existing null rows to match, since that
-- default didn't exist when they were created.
alter table leads add column is_hot boolean not null default false;
update leads set estimated_value = 2750 where estimated_value is null;
