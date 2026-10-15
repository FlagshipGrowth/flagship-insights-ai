-- Backs the task detail popup's comment thread (click into a task on the internal brand hub).
create table task_comments (
    id          uuid primary key default gen_random_uuid(),
    task_id     uuid not null references tasks(id) on delete cascade,
    author      text not null,
    body        text not null,
    created_at  timestamptz not null default now()
);
create index task_comments_task_id_idx on task_comments(task_id);
