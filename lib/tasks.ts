import { getDb } from "./db";

export { TASK_STATUSES, type TaskStatus } from "./task-status";

export const TASK_SORTS = ["default", "created_desc", "created_asc", "due_date"] as const;
export type TaskSort = (typeof TASK_SORTS)[number];

export async function getTasks(brandId: string, sort: TaskSort = "default") {
  const sql = getDb();
  // Four full queries rather than composing one dynamically — the neon serverless driver's
  // sql`` tag treats every ${} as a bound value parameter, not a raw SQL fragment, so there's no
  // safe way to interpolate just the ORDER BY clause into one shared query.
  switch (sort) {
    case "created_desc":
      return sql`
        select id, title, description, category, status, assignee, due_date, created_at
        from tasks where brand_id = ${brandId} order by created_at desc
      `;
    case "created_asc":
      return sql`
        select id, title, description, category, status, assignee, due_date, created_at
        from tasks where brand_id = ${brandId} order by created_at asc
      `;
    case "due_date":
      return sql`
        select id, title, description, category, status, assignee, due_date, created_at
        from tasks where brand_id = ${brandId}
        order by due_date nulls last, created_at desc
      `;
    default:
      return sql`
        select id, title, description, category, status, assignee, due_date, created_at
        from tasks where brand_id = ${brandId}
        order by case status when 'todo' then 0 when 'in_progress' then 1 else 2 end, due_date nulls last, created_at desc
      `;
  }
}

export interface TaskComment {
  id: string;
  taskId: string;
  author: string;
  body: string;
  createdAt: string;
}

/** All comments for every task on a brand, in one query — grouped by task on the caller's side
 * rather than fetched per-task, since comment volume per brand is small. */
export async function getTaskCommentsForBrand(brandId: string): Promise<TaskComment[]> {
  const sql = getDb();
  const rows = await sql`
    select c.id, c.task_id, c.author, c.body, c.created_at
    from task_comments c
    join tasks t on t.id = c.task_id
    where t.brand_id = ${brandId}
    order by c.created_at asc
  `;
  return rows.map((r: any) => ({
    id: r.id,
    taskId: r.task_id,
    author: r.author,
    body: r.body,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  }));
}
