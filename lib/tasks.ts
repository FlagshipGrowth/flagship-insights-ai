import { getDb } from "./db";

export { TASK_STATUSES, type TaskStatus } from "./task-status";

export async function getTasks(brandId: string) {
  const sql = getDb();
  return sql`
    select id, title, description, category, status, assignee, due_date, created_at
    from tasks
    where brand_id = ${brandId}
    order by
      case status when 'todo' then 0 when 'in_progress' then 1 else 2 end,
      due_date nulls last,
      created_at desc
  `;
}
