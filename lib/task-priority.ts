// Split out from lib/tasks.ts so client components (TaskPrioritySelect) can import just the
// constant without pulling in getDb()'s server-only Postgres driver into the client bundle.
export const TASK_PRIORITIES = ["low", "med", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  med: "Medium",
  high: "High",
};

// Highest first — used to rank the "My Tasks" personal dashboard; unset priority sorts last.
export function priorityRank(priority: string | null): number {
  if (priority === "high") return 0;
  if (priority === "med") return 1;
  if (priority === "low") return 2;
  return 3;
}
