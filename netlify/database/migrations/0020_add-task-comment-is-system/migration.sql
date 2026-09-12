-- Distinguishes automated activity-log entries ("changed due date to ...") from real human
-- comments in the same task_comments thread, so the UI can style them differently.
alter table task_comments add column is_system boolean not null default false;
