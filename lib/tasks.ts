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
        select id, title, description, category, status, assignee, team, due_date, created_at
        from tasks where brand_id = ${brandId} order by created_at desc
      `;
    case "created_asc":
      return sql`
        select id, title, description, category, status, assignee, team, due_date, created_at
        from tasks where brand_id = ${brandId} order by created_at asc
      `;
    case "due_date":
      return sql`
        select id, title, description, category, status, assignee, team, due_date, created_at
        from tasks where brand_id = ${brandId}
        order by due_date nulls last, created_at desc
      `;
    default:
      return sql`
        select id, title, description, category, status, assignee, team, due_date, created_at
        from tasks where brand_id = ${brandId}
        order by case status when 'todo' then 0 when 'in_progress' then 1 else 2 end, due_date nulls last, created_at desc
      `;
  }
}

export interface AdminTask {
  id: string;
  brandId: string;
  brandName: string;
  title: string;
  category: string | null;
  status: string;
  assignee: string | null;
  team: string | null;
  dueDate: string | null;
  createdAt: string;
}

function normalizeAdminTask(r: any): AdminTask {
  return {
    id: r.id,
    brandId: r.brand_id,
    brandName: r.brand_name,
    title: r.title,
    category: r.category,
    status: r.status,
    assignee: r.assignee,
    team: r.team,
    dueDate: r.due_date instanceof Date ? r.due_date.toISOString() : r.due_date,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  };
}

/** Open (not-done) task count per team, across every brand — for the cross-brand admin task
 * view. Includes every team from TEAMS even at zero, so the caller doesn't have to backfill. */
export async function getOpenTaskCountsByTeam(): Promise<Record<string, number>> {
  const sql = getDb();
  const rows = await sql`
    select team, count(*) as open_count
    from tasks
    where status != 'done' and team is not null
    group by team
  `;
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.team] = Number(r.open_count);
  return counts;
}

/**
 * All tasks across every brand, for the internal_admin-only cross-brand view. `includeDone`
 * controls whether finished tasks are included at all; `team` filters to one team when given.
 */
export async function getAllTasksForAdmin(
  sort: TaskSort,
  { team, includeDone }: { team?: string; includeDone?: boolean } = {}
): Promise<AdminTask[]> {
  const sql = getDb();
  // team/includeDone are plain bound parameters (not composed sql`` fragments — the neon
  // serverless driver's sql`` tag treats every ${} as a value, not raw SQL, so "no filter" has
  // to be expressed as a WHERE condition rather than an omitted clause).
  const teamParam = team ?? null;
  const includeDoneParam = includeDone ?? false;

  switch (sort) {
    case "created_desc":
      return (
        await sql`
          select t.id, t.brand_id, b.name as brand_name, t.title, t.category, t.status, t.assignee, t.team,
                 t.due_date, t.created_at
          from tasks t join brands b on b.id = t.brand_id
          where (t.status != 'done' or ${includeDoneParam}) and (${teamParam}::text is null or t.team = ${teamParam})
          order by t.created_at desc
        `
      ).map(normalizeAdminTask);
    case "created_asc":
      return (
        await sql`
          select t.id, t.brand_id, b.name as brand_name, t.title, t.category, t.status, t.assignee, t.team,
                 t.due_date, t.created_at
          from tasks t join brands b on b.id = t.brand_id
          where (t.status != 'done' or ${includeDoneParam}) and (${teamParam}::text is null or t.team = ${teamParam})
          order by t.created_at asc
        `
      ).map(normalizeAdminTask);
    case "due_date":
      return (
        await sql`
          select t.id, t.brand_id, b.name as brand_name, t.title, t.category, t.status, t.assignee, t.team,
                 t.due_date, t.created_at
          from tasks t join brands b on b.id = t.brand_id
          where (t.status != 'done' or ${includeDoneParam}) and (${teamParam}::text is null or t.team = ${teamParam})
          order by t.due_date nulls last, t.created_at desc
        `
      ).map(normalizeAdminTask);
    default:
      return (
        await sql`
          select t.id, t.brand_id, b.name as brand_name, t.title, t.category, t.status, t.assignee, t.team,
                 t.due_date, t.created_at
          from tasks t join brands b on b.id = t.brand_id
          where (t.status != 'done' or ${includeDoneParam}) and (${teamParam}::text is null or t.team = ${teamParam})
          order by case t.status when 'todo' then 0 when 'in_progress' then 1 else 2 end, t.due_date nulls last, t.created_at desc
        `
      ).map(normalizeAdminTask);
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
