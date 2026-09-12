import { getDb } from "./db";

export { TASK_STATUSES, type TaskStatus } from "./task-status";

export const TASK_SORTS = ["default", "created_desc", "created_asc", "due_date"] as const;
export type TaskSort = (typeof TASK_SORTS)[number];

export interface Task {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
  assignee: string | null;
  team: string | null;
  priority: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

function normalizeTask(r: any): Task {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    status: r.status,
    assignee: r.assignee,
    team: r.team,
    priority: r.priority,
    due_date: r.due_date instanceof Date ? r.due_date.toISOString() : r.due_date,
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

// Sentinel filter value meaning "no team/assignee set", not a literal string any task actually
// has — lets one dropdown express both "show everything" (param left out) and "show only the
// unassigned ones" (this sentinel) without a separate UI control for each.
export const UNASSIGNED_FILTER = "__unassigned__";

export async function getTasks(
  brandId: string,
  sort: TaskSort = "default",
  filters: { team?: string; assignee?: string } = {}
): Promise<Task[]> {
  const sql = getDb();
  // Four full queries rather than composing one dynamically — the neon serverless driver's
  // sql`` tag treats every ${} as a bound value parameter, not a raw SQL fragment, so there's no
  // safe way to interpolate just the ORDER BY clause into one shared query. Same reasoning for
  // expressing "no filter" as a WHERE condition (team/assignee params) rather than an omitted
  // clause.
  const teamParam = filters.team ?? null;
  const assigneeParam = filters.assignee ?? null;

  switch (sort) {
    case "created_desc":
      return (
        await sql`
          select id, title, description, category, status, assignee, team, priority, due_date, created_at, updated_at
          from tasks
          where brand_id = ${brandId}
            and (${teamParam}::text is null or (${teamParam} = ${UNASSIGNED_FILTER} and team is null) or team = ${teamParam})
            and (${assigneeParam}::text is null or (${assigneeParam} = ${UNASSIGNED_FILTER} and assignee is null) or assignee = ${assigneeParam})
          order by created_at desc
        `
      ).map(normalizeTask);
    case "created_asc":
      return (
        await sql`
          select id, title, description, category, status, assignee, team, priority, due_date, created_at, updated_at
          from tasks
          where brand_id = ${brandId}
            and (${teamParam}::text is null or (${teamParam} = ${UNASSIGNED_FILTER} and team is null) or team = ${teamParam})
            and (${assigneeParam}::text is null or (${assigneeParam} = ${UNASSIGNED_FILTER} and assignee is null) or assignee = ${assigneeParam})
          order by created_at asc
        `
      ).map(normalizeTask);
    case "due_date":
      return (
        await sql`
          select id, title, description, category, status, assignee, team, priority, due_date, created_at, updated_at
          from tasks
          where brand_id = ${brandId}
            and (${teamParam}::text is null or (${teamParam} = ${UNASSIGNED_FILTER} and team is null) or team = ${teamParam})
            and (${assigneeParam}::text is null or (${assigneeParam} = ${UNASSIGNED_FILTER} and assignee is null) or assignee = ${assigneeParam})
          order by due_date nulls last, created_at desc
        `
      ).map(normalizeTask);
    default:
      return (
        await sql`
          select id, title, description, category, status, assignee, team, priority, due_date, created_at, updated_at
          from tasks
          where brand_id = ${brandId}
            and (${teamParam}::text is null or (${teamParam} = ${UNASSIGNED_FILTER} and team is null) or team = ${teamParam})
            and (${assigneeParam}::text is null or (${assigneeParam} = ${UNASSIGNED_FILTER} and assignee is null) or assignee = ${assigneeParam})
          order by case status when 'todo' then 0 when 'in_progress' then 1 else 2 end, due_date nulls last, created_at desc
        `
      ).map(normalizeTask);
  }
}

/** Distinct assignee values already in use on this brand's tasks — populates the assignee filter
 * dropdown with real options instead of a free-text field prone to typos/mismatches. */
export async function getDistinctAssignees(brandId: string): Promise<string[]> {
  const sql = getDb();
  const rows = await sql`
    select distinct assignee from tasks where brand_id = ${brandId} and assignee is not null order by assignee
  `;
  return rows.map((r: any) => r.assignee);
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
  priority: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
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
    priority: r.priority,
    dueDate: r.due_date instanceof Date ? r.due_date.toISOString() : r.due_date,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
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
                 t.priority, t.due_date, t.created_at, t.updated_at
          from tasks t join brands b on b.id = t.brand_id
          where (t.status != 'done' or ${includeDoneParam}) and (${teamParam}::text is null or t.team = ${teamParam})
          order by t.created_at desc
        `
      ).map(normalizeAdminTask);
    case "created_asc":
      return (
        await sql`
          select t.id, t.brand_id, b.name as brand_name, t.title, t.category, t.status, t.assignee, t.team,
                 t.priority, t.due_date, t.created_at, t.updated_at
          from tasks t join brands b on b.id = t.brand_id
          where (t.status != 'done' or ${includeDoneParam}) and (${teamParam}::text is null or t.team = ${teamParam})
          order by t.created_at asc
        `
      ).map(normalizeAdminTask);
    case "due_date":
      return (
        await sql`
          select t.id, t.brand_id, b.name as brand_name, t.title, t.category, t.status, t.assignee, t.team,
                 t.priority, t.due_date, t.created_at, t.updated_at
          from tasks t join brands b on b.id = t.brand_id
          where (t.status != 'done' or ${includeDoneParam}) and (${teamParam}::text is null or t.team = ${teamParam})
          order by t.due_date nulls last, t.created_at desc
        `
      ).map(normalizeAdminTask);
    default:
      return (
        await sql`
          select t.id, t.brand_id, b.name as brand_name, t.title, t.category, t.status, t.assignee, t.team,
                 t.priority, t.due_date, t.created_at, t.updated_at
          from tasks t join brands b on b.id = t.brand_id
          where (t.status != 'done' or ${includeDoneParam}) and (${teamParam}::text is null or t.team = ${teamParam})
          order by case t.status when 'todo' then 0 when 'in_progress' then 1 else 2 end, t.due_date nulls last, t.created_at desc
        `
      ).map(normalizeAdminTask);
  }
}

/**
 * A person's own open tasks across every brand, ranked by priority (high first, then due date,
 * then newest) — the "My Tasks" personal dashboard. Matching is by name, live at query time
 * (case-insensitive against `assignee`) rather than a persisted per-user link: everyone's email
 * is `name@flagshipgrowth.com`, so whoever's logged in just needs their own name compared
 * against whatever's already in `assignee` — no signup-time backfill step to keep in sync.
 */
export async function getOpenTasksForAssignee(name: string): Promise<AdminTask[]> {
  const sql = getDb();
  const rows = await sql`
    select t.id, t.brand_id, b.name as brand_name, t.title, t.category, t.status, t.assignee, t.team,
           t.priority, t.due_date, t.created_at, t.updated_at
    from tasks t join brands b on b.id = t.brand_id
    where lower(t.assignee) = lower(${name}) and t.status != 'done'
    order by
      case t.priority when 'high' then 0 when 'med' then 1 when 'low' then 2 else 3 end,
      t.due_date nulls last,
      t.created_at desc
  `;
  return rows.map(normalizeAdminTask);
}

export interface TaskComment {
  id: string;
  taskId: string;
  author: string;
  body: string;
  isSystem: boolean;
  createdAt: string;
}

/** All comments for every task on a brand, in one query — grouped by task on the caller's side
 * rather than fetched per-task, since comment volume per brand is small. */
export async function getTaskCommentsForBrand(brandId: string): Promise<TaskComment[]> {
  const sql = getDb();
  const rows = await sql`
    select c.id, c.task_id, c.author, c.body, c.is_system, c.created_at
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
    isSystem: r.is_system,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  }));
}

/** All comments for a single task, across brands — used by the admin cross-brand task view. */
export async function getTaskComments(taskId: string): Promise<TaskComment[]> {
  const sql = getDb();
  const rows = await sql`
    select id, task_id, author, body, is_system, created_at
    from task_comments where task_id = ${taskId} order by created_at asc
  `;
  return rows.map((r: any) => ({
    id: r.id,
    taskId: r.task_id,
    author: r.author,
    body: r.body,
    isSystem: r.is_system,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  }));
}

/** Records an automated "changed X to Y" entry in a task's comment thread, attributed to whoever
 * made the change — same thread real comments show up in, so people see the full history in one
 * place. Not used for task creation itself, only edits made afterward. */
export async function logTaskActivity(taskId: string, author: string, message: string): Promise<void> {
  const sql = getDb();
  await sql`insert into task_comments (task_id, author, body, is_system) values (${taskId}, ${author}, ${message}, true)`;
}
