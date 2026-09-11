// Split out from lib/tasks.ts so client components (TaskStatusSelect) can import just the
// constant without pulling in getDb()'s server-only Postgres driver into the client bundle.
export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
