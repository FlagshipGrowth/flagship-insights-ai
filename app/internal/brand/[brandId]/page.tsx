import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { getUserContext, isInternalStaff, canStaffAccessBrand } from "@/lib/user-context";
import { getBrandMetrics, getBrandMetricsTimeSeries, PERIODS, type Period } from "@/lib/metrics";
import { getBrandName } from "@/lib/seo";
import { getBrandReportLinks, getInventoryPreview, getReconciliationSummary } from "@/lib/reports";
import {
  getTasks,
  getTaskCommentsForBrand,
  getDistinctAssignees,
  logTaskActivity,
  UNASSIGNED_FILTER,
  TASK_STATUSES,
  TASK_SORTS,
  type TaskSort,
} from "@/lib/tasks";
import { getBrandSlackChannelId, getBrandClientInfo } from "@/lib/brands";
import { getUsersWithBrandAccess } from "@/lib/staff";
import { TEAMS, resolveAssignee } from "@/lib/teams";
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS } from "@/lib/task-priority";
import { getDb } from "@/lib/db";
import { Badge } from "@/components/Badge";
import { MetricsChart } from "@/components/MetricsChart";
import { InventoryPreviewCard } from "@/components/InventoryPreviewCard";
import { ReconciliationPreviewCard } from "@/components/ReconciliationPreviewCard";
import { ConfirmButton } from "@/components/ConfirmButton";
import { TaskCard } from "./TaskCard";

const CLIENT_USER_ROLES = ["client_owner", "client_teammate"] as const;

const TASK_SORT_LABELS: Record<TaskSort, string> = {
  default: "Status",
  created_desc: "Newest created",
  created_asc: "Oldest created",
  due_date: "Due date",
};

async function createTask(brandId: string, formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isInternalStaff(ctx)) return;
  if (!(await canStaffAccessBrand(ctx, brandId))) return;

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const assignee = (formData.get("assignee") as string)?.trim() || null;
  const dueDate = (formData.get("dueDate") as string) || null;
  const team = (formData.get("team") as string) || null;
  const priority = (formData.get("priority") as string) || null;
  if (!title) return;
  if (team && !(TEAMS as readonly string[]).includes(team)) return;
  if (priority && !(TASK_PRIORITIES as readonly string[]).includes(priority)) return;

  const sql = getDb();
  await sql`
    insert into tasks (brand_id, title, description, assignee, team, priority, due_date, created_by)
    values (${brandId}, ${title}, ${description}, ${resolveAssignee(team, assignee)}, ${team}, ${priority}, ${dueDate}, ${ctx.id})
  `;
  revalidatePath(`/internal/brand/${brandId}`);
}

async function updateTaskStatus(brandId: string, formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isInternalStaff(ctx)) return;
  if (!(await canStaffAccessBrand(ctx, brandId))) return;

  const taskId = formData.get("taskId") as string;
  const status = formData.get("status") as string;
  if (!TASK_STATUSES.includes(status as any)) return;

  const sql = getDb();
  const before = await sql`select status from tasks where id = ${taskId} and brand_id = ${brandId}`;
  if (before.length === 0 || before[0].status === status) return;

  await sql`update tasks set status = ${status}, updated_at = now() where id = ${taskId} and brand_id = ${brandId}`;
  await logTaskActivity(
    taskId,
    ctx.email,
    `changed status from ${before[0].status.replace("_", " ")} to ${status.replace("_", " ")}`
  );
  revalidatePath(`/internal/brand/${brandId}`);
}

async function updateTaskTeam(brandId: string, formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isInternalStaff(ctx)) return;
  if (!(await canStaffAccessBrand(ctx, brandId))) return;

  const taskId = formData.get("taskId") as string;
  const team = (formData.get("team") as string) || null;
  if (team && !(TEAMS as readonly string[]).includes(team)) return;

  const sql = getDb();
  const before = await sql`select team, assignee from tasks where id = ${taskId} and brand_id = ${brandId}`;
  if (before.length === 0 || before[0].team === team) return;

  const assignee = resolveAssignee(team, before[0].assignee);
  await sql`update tasks set team = ${team}, assignee = ${assignee}, updated_at = now() where id = ${taskId} and brand_id = ${brandId}`;
  await logTaskActivity(
    taskId,
    ctx.email,
    `changed team to ${team ?? "unassigned"}` + (assignee !== before[0].assignee ? ` (assignee set to ${assignee})` : "")
  );
  revalidatePath(`/internal/brand/${brandId}`);
}

async function updateTaskPriority(brandId: string, formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isInternalStaff(ctx)) return;
  if (!(await canStaffAccessBrand(ctx, brandId))) return;

  const taskId = formData.get("taskId") as string;
  const priority = (formData.get("priority") as string) || null;
  if (priority && !(TASK_PRIORITIES as readonly string[]).includes(priority)) return;

  const sql = getDb();
  const before = await sql`select priority from tasks where id = ${taskId} and brand_id = ${brandId}`;
  if (before.length === 0 || before[0].priority === priority) return;

  await sql`update tasks set priority = ${priority}, updated_at = now() where id = ${taskId} and brand_id = ${brandId}`;
  await logTaskActivity(taskId, ctx.email, `changed priority to ${priority ?? "none"}`);
  revalidatePath(`/internal/brand/${brandId}`);
}

async function updateTaskDueDate(brandId: string, formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isInternalStaff(ctx)) return;
  if (!(await canStaffAccessBrand(ctx, brandId))) return;

  const taskId = formData.get("taskId") as string;
  const dueDate = (formData.get("dueDate") as string) || null;

  const sql = getDb();
  const before = await sql`select due_date from tasks where id = ${taskId} and brand_id = ${brandId}`;
  if (before.length === 0) return;
  const beforeDate = before[0].due_date instanceof Date ? before[0].due_date.toISOString().slice(0, 10) : null;
  if (beforeDate === dueDate) return;

  await sql`update tasks set due_date = ${dueDate}, updated_at = now() where id = ${taskId} and brand_id = ${brandId}`;
  await logTaskActivity(taskId, ctx.email, `changed due date to ${dueDate ?? "none"}`);
  revalidatePath(`/internal/brand/${brandId}`);
}

async function deleteTask(brandId: string, formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isInternalStaff(ctx)) return;
  if (!(await canStaffAccessBrand(ctx, brandId))) return;

  const taskId = formData.get("taskId") as string;
  const sql = getDb();
  await sql`delete from tasks where id = ${taskId} and brand_id = ${brandId}`;
  revalidatePath(`/internal/brand/${brandId}`);
}

async function addTaskComment(brandId: string, formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isInternalStaff(ctx)) return;
  if (!(await canStaffAccessBrand(ctx, brandId))) return;

  const taskId = formData.get("taskId") as string;
  const body = (formData.get("body") as string)?.trim();
  if (!taskId || !body) return;

  const sql = getDb();
  await sql`
    insert into task_comments (task_id, author, body)
    select id, ${ctx.email}, ${body} from tasks where id = ${taskId} and brand_id = ${brandId}
  `;
  revalidatePath(`/internal/brand/${brandId}`);
}

async function updateSlackChannel(brandId: string, formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isInternalStaff(ctx)) return;
  if (!(await canStaffAccessBrand(ctx, brandId))) return;

  const channelId = (formData.get("slackChannelId") as string)?.trim() || null;
  const sql = getDb();
  await sql`update brands set slack_channel_id = ${channelId} where id = ${brandId}`;
  revalidatePath(`/internal/brand/${brandId}`);
}

async function addBrandUser(brandId: string, formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || ctx.role !== "internal_admin") return;

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const role = formData.get("role") as string;
  if (!email || !(CLIENT_USER_ROLES as readonly string[]).includes(role)) return;

  const client = await getBrandClientInfo(brandId);
  if (!client) return;

  const sql = getDb();
  // Pre-provision locally (clerk_user_id left null) so the admin sees them right away, even
  // before the invite is accepted — the webhook's organizationMembership.created handler links
  // this same row up by email once they actually sign in (see its "on conflict (email)" comment).
  await sql`
    insert into users (client_id, role, email)
    values (${client.clientId}, ${role}, ${email})
    on conflict (email) do update set role = excluded.role, client_id = excluded.client_id
  `;

  if (client.clerkOrgId) {
    const clerk = await clerkClient();
    await clerk.organizations.createOrganizationInvitation({
      organizationId: client.clerkOrgId,
      emailAddress: email,
      role: role === "client_owner" ? "org:admin" : "org:member",
    });
  }
  revalidatePath(`/internal/brand/${brandId}`);
}

async function deleteBrandUser(brandId: string, formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || ctx.role !== "internal_admin") return;

  const userId = formData.get("userId") as string;
  const client = await getBrandClientInfo(brandId);
  if (!client) return;

  const sql = getDb();
  const rows = await sql`select id, role, clerk_user_id, client_id from users where id = ${userId}`;
  if (rows.length === 0) return;
  const user = rows[0];

  if (user.role === "account_manager") {
    // Only unassigns them from this client — their internal_admin/account_manager account
    // itself is managed at /internal/assignments, not deleted from here.
    await sql`delete from account_manager_assignments where user_id = ${userId} and client_id = ${client.clientId}`;
  } else {
    if (user.client_id !== client.clientId) return;

    if (user.clerk_user_id && client.clerkOrgId) {
      const clerk = await clerkClient();
      try {
        await clerk.organizations.deleteOrganizationMembership({
          organizationId: client.clerkOrgId,
          userId: user.clerk_user_id,
        });
      } catch {
        // Already gone on Clerk's side — still remove the local row below either way.
      }
    }
    await sql`delete from users where id = ${userId}`;
  }
  revalidatePath(`/internal/brand/${brandId}`);
}

async function deleteBrand(brandId: string, formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || ctx.role !== "internal_admin") return;

  const sql = getDb();
  // Cascades to every FK'd table (tasks, connections, metrics_daily, task_comments via tasks,
  // etc.) via existing `on delete cascade` constraints — no manual cleanup needed here.
  await sql`delete from brands where id = ${brandId}`;
  redirect("/internal");
}

export default async function BrandHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>;
  searchParams: Promise<{ period?: string; taskSort?: string; teamFilter?: string; assigneeFilter?: string }>;
}) {
  const { brandId } = await params;
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (!isInternalStaff(ctx)) redirect("/dashboard");
  if (!(await canStaffAccessBrand(ctx, brandId))) redirect("/internal");

  const brandName = await getBrandName(brandId);
  if (!brandName) redirect("/internal");

  const {
    period: periodParam,
    taskSort: taskSortParam,
    teamFilter: teamFilterParam,
    assigneeFilter: assigneeFilterParam,
  } = await searchParams;
  const period: Period = (PERIODS as string[]).includes(periodParam ?? "") ? (periodParam as Period) : "mtd";
  const taskSort: TaskSort = (TASK_SORTS as readonly string[]).includes(taskSortParam ?? "")
    ? (taskSortParam as TaskSort)
    : "default";
  const teamFilter = teamFilterParam || undefined;
  const assigneeFilter = assigneeFilterParam || undefined;

  const metrics = await getBrandMetrics(brandId, period);
  const metricsSeries = await getBrandMetricsTimeSeries(brandId, period);
  const { weeklyReportUrls, inventoryReportUrls, reconciliationReportUrls } = await getBrandReportLinks(brandId);
  const inventoryPreview = await getInventoryPreview(brandId);
  const reconciliationSummary = await getReconciliationSummary(brandId);
  const tasks = await getTasks(brandId, taskSort, { team: teamFilter, assignee: assigneeFilter });
  const distinctAssignees = await getDistinctAssignees(brandId);
  const comments = await getTaskCommentsForBrand(brandId);
  const commentsByTask = new Map<string, typeof comments>();
  for (const c of comments) {
    if (!commentsByTask.has(c.taskId)) commentsByTask.set(c.taskId, []);
    commentsByTask.get(c.taskId)!.push(c);
  }
  const slackChannelId = await getBrandSlackChannelId(brandId);
  const isAdmin = ctx.role === "internal_admin";
  const clientInfo = isAdmin ? await getBrandClientInfo(brandId) : null;
  const brandUsers = clientInfo ? await getUsersWithBrandAccess(clientInfo.clientId) : [];
  const activeTasks = tasks.filter((t) => t.status !== "done");
  const doneTasks = tasks
    .filter((t) => t.status === "done")
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  const tasksByCategory = new Map<string, typeof tasks>();
  for (const t of activeTasks as any[]) {
    const key = t.category ?? "Other";
    if (!tasksByCategory.has(key)) tasksByCategory.set(key, []);
    tasksByCategory.get(key)!.push(t);
  }
  const boundCreateTask = createTask.bind(null, brandId);
  const boundUpdateStatus = updateTaskStatus.bind(null, brandId);
  const boundUpdateTeam = updateTaskTeam.bind(null, brandId);
  const boundUpdatePriority = updateTaskPriority.bind(null, brandId);
  const boundUpdateDueDate = updateTaskDueDate.bind(null, brandId);
  const boundDeleteTask = deleteTask.bind(null, brandId);
  const boundAddComment = addTaskComment.bind(null, brandId);
  const boundUpdateSlackChannel = updateSlackChannel.bind(null, brandId);
  const boundAddBrandUser = addBrandUser.bind(null, brandId);
  const boundDeleteBrandUser = deleteBrandUser.bind(null, brandId);
  const boundDeleteBrand = deleteBrand.bind(null, brandId);

  return (
    <main>
      <a href="/internal" className="back-link">
        &larr; All brands
      </a>
      <h1 style={{ marginBottom: 24 }}>{brandName}</h1>

      <section style={{ marginBottom: 32 }}>
        <h2>Performance</h2>
        <nav className="pill-nav">
          {PERIODS.map((p) => (
            <a key={p} href={`/internal/brand/${brandId}?period=${p}`} className={p === period ? "active" : ""}>
              {p.toUpperCase()}
            </a>
          ))}
        </nav>
        {metrics.length === 0 ? (
          <p>No metrics for this period yet.</p>
        ) : (
          <div className="card" style={{ maxWidth: 720 }}>
            <MetricsChart series={metricsSeries as any} />
          </div>
        )}
      </section>

      {(weeklyReportUrls.length > 0 || inventoryReportUrls.length > 0 || reconciliationReportUrls.length > 0) && (
        <section style={{ marginBottom: 32 }}>
          <h2>Reports</h2>
          <p>
            <small>Updated weekly by the reporting pipeline, usually Monday or Tuesday.</small>
          </p>
          <div className="card" style={{ maxWidth: 640, padding: 0, overflow: "hidden" }}>
            {[
              ...weeklyReportUrls.map((r) => ({
                label: `Weekly Sales/Ads Report${r.label ? ` (${r.label})` : ""}`,
                url: r.url,
              })),
              ...inventoryReportUrls.map((r) => ({
                label: `Inventory Report${r.label ? ` (${r.label})` : ""}`,
                url: r.url,
              })),
              ...reconciliationReportUrls.map((r) => ({
                label: `Reconciliation Report${r.label ? ` (${r.label})` : ""}`,
                url: r.url,
              })),
            ].map((report, i, arr) => (
              <div
                key={report.url}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 20px",
                  borderBottom: i < arr.length - 1 ? "1px solid var(--paper-2)" : "none",
                }}
              >
                <span>{report.label}</span>
                <a href={report.url} target="_blank" rel="noopener noreferrer">
                  Open →
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      {inventoryPreview && (
        <InventoryPreviewCard preview={inventoryPreview} reportUrl={inventoryReportUrls[0]?.url} />
      )}

      {reconciliationSummary && (
        <ReconciliationPreviewCard summary={reconciliationSummary} reportUrl={reconciliationReportUrls[0]?.url} />
      )}

      <section style={{ marginBottom: 32 }}>
        <h2>Tasks</h2>

        <nav className="pill-nav">
          {TASK_SORTS.map((s) => (
            <a
              key={s}
              href={`/internal/brand/${brandId}?period=${period}&taskSort=${s}&teamFilter=${teamFilter ?? ""}&assigneeFilter=${assigneeFilter ?? ""}`}
              className={s === taskSort ? "active" : ""}
            >
              {TASK_SORT_LABELS[s]}
            </a>
          ))}
        </nav>

        <form
          style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 20 }}
        >
          <input type="hidden" name="period" value={period} />
          <input type="hidden" name="taskSort" value={taskSort} />
          <label>
            Team
            <br />
            <select name="teamFilter" defaultValue={teamFilter ?? ""}>
              <option value="">All teams</option>
              <option value={UNASSIGNED_FILTER}>Unassigned</option>
              {TEAMS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Assignee
            <br />
            <select name="assigneeFilter" defaultValue={assigneeFilter ?? ""}>
              <option value="">All assignees</option>
              <option value={UNASSIGNED_FILTER}>Unassigned</option>
              {distinctAssignees.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Filter</button>
          {(teamFilter || assigneeFilter) && (
            <a href={`/internal/brand/${brandId}?period=${period}&taskSort=${taskSort}`}>Clear filters</a>
          )}
        </form>

        {activeTasks.length === 0 ? (
          <p>{teamFilter || assigneeFilter ? "No tasks match this filter." : "No open tasks."}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1000 }}>
            {Array.from(tasksByCategory.entries()).map(([category, categoryTasks]) => (
              <div key={category}>
                <h3 style={{ marginBottom: 8 }}>{category}</h3>
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                  {(categoryTasks as any[]).map((t: any, i: number, arr: any[]) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      comments={commentsByTask.get(t.id) ?? []}
                      isLast={i === arr.length - 1}
                      boundUpdateStatus={boundUpdateStatus}
                      boundUpdateTeam={boundUpdateTeam}
                      boundUpdatePriority={boundUpdatePriority}
                      boundUpdateDueDate={boundUpdateDueDate}
                      boundDeleteTask={boundDeleteTask}
                      boundAddComment={boundAddComment}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <details style={{ marginTop: 24, maxWidth: 1000 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Completed ({doneTasks.length})</summary>
          <div style={{ marginTop: 12 }}>
            {doneTasks.length === 0 ? (
              <p>
                <small style={{ color: "var(--muted)" }}>No completed tasks yet.</small>
              </p>
            ) : (
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                {doneTasks.map((t: any, i: number) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    comments={commentsByTask.get(t.id) ?? []}
                    isLast={i === doneTasks.length - 1}
                    boundUpdateStatus={boundUpdateStatus}
                    boundUpdateTeam={boundUpdateTeam}
                    boundUpdatePriority={boundUpdatePriority}
                    boundUpdateDueDate={boundUpdateDueDate}
                    boundDeleteTask={boundDeleteTask}
                    boundAddComment={boundAddComment}
                  />
                ))}
              </div>
            )}
          </div>
        </details>

        <div className="card" style={{ marginTop: 16, maxWidth: 640 }}>
          <form action={boundCreateTask} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label>
              Title
              <br />
              <input name="title" required style={{ width: "100%" }} />
            </label>
            <div style={{ display: "flex", gap: 12 }}>
              <label style={{ flex: 1 }}>
                Assignee
                <br />
                <input name="assignee" style={{ width: "100%" }} />
              </label>
              <label style={{ flex: 1 }}>
                Team
                <br />
                <select name="team" defaultValue="" style={{ width: "100%" }}>
                  <option value="">Unassigned team</option>
                  {TEAMS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ flex: 1 }}>
                Due date
                <br />
                <input name="dueDate" type="date" style={{ width: "100%" }} />
              </label>
              <label style={{ flex: 1 }}>
                Priority
                <br />
                <select name="priority" defaultValue="" style={{ width: "100%" }}>
                  <option value="">No priority</option>
                  {TASK_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {TASK_PRIORITY_LABELS[p]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Description
              <br />
              <textarea name="description" rows={2} style={{ width: "100%" }} />
            </label>
            <button type="submit" style={{ alignSelf: "flex-start" }}>
              Add task
            </button>
          </form>
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>Tools</h2>
        <div className="card" style={{ maxWidth: 640, padding: 0, overflow: "hidden" }}>
          {[
            { label: "Product optimizations (SEO)", href: `/internal/seo/${brandId}`, available: true },
            { label: "Bulk SEO listing upload", href: `/internal/brand/${brandId}/seo-bulk`, available: true },
            { label: "Inventory", href: `/internal/brand/${brandId}/inventory`, available: true },
            { label: "Catalog", href: `/internal/brand/${brandId}/catalog`, available: true },
            { label: "Item-level margin calculator", href: `/internal/brand/${brandId}/margin-calculator`, available: true },
            { label: "Forecast", href: `/internal/brand/${brandId}/forecast`, available: false },
            { label: "Reimbursements", href: `/internal/brand/${brandId}/reimbursements`, available: false },
            { label: "Reviews", href: `/internal/brand/${brandId}/reviews`, available: false },
          ].map((tool, i, arr) => (
            <div
              key={tool.href}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 20px",
                borderBottom: i < arr.length - 1 ? "1px solid var(--paper-2)" : "none",
              }}
            >
              <span>
                {tool.label} {!tool.available && <Badge variant="pending">pending Amazon</Badge>}
              </span>
              <a href={tool.href}>Open →</a>
            </div>
          ))}
        </div>
      </section>

      <details style={{ marginTop: 32 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Slack</summary>
        <div style={{ marginTop: 12 }}>
          <p>
            <small>
              Map this brand to its internal Slack channel so <code>/create-task</code> run in that channel creates
              the task here automatically, with no <code>client:</code> needed.
            </small>
          </p>
          <div className="card" style={{ maxWidth: 480 }}>
            <form action={boundUpdateSlackChannel} style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
              <label style={{ flex: 1 }}>
                Slack channel ID
                <br />
                <input
                  name="slackChannelId"
                  defaultValue={slackChannelId ?? ""}
                  placeholder="C0123ABC456"
                  style={{ width: "100%" }}
                />
              </label>
              <button type="submit">Save</button>
            </form>
            <p style={{ marginTop: 8 }}>
              <small>
                Find it in Slack: open the channel → channel name → "About" tab → scroll to the bottom.
              </small>
            </p>
          </div>
        </div>
      </details>

      {isAdmin && clientInfo && (
        <details style={{ marginTop: 24 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Team access</summary>
          <div style={{ marginTop: 12 }}>
            <p>
              <small>
                Everyone who can see {brandName} in the client portal, plus any account managers assigned to{" "}
                {clientInfo.clientName}.
              </small>
            </p>

            {brandUsers.length === 0 ? (
              <p>
                <small style={{ color: "var(--muted)" }}>No one has portal access yet.</small>
              </p>
            ) : (
              <div className="card" style={{ padding: 0, overflow: "hidden", maxWidth: 640 }}>
                {brandUsers.map((u, i, arr) => (
                  <div
                    key={u.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 16px",
                      borderBottom: i < arr.length - 1 ? "1px solid var(--paper-2)" : "none",
                    }}
                  >
                    <span>
                      {u.email}{" "}
                      <small style={{ color: "var(--muted)" }}>
                        ({u.role.replace("_", " ")}
                        {!u.hasClerkAccount ? ", invited — not signed in yet" : ""})
                      </small>
                    </span>
                    <form action={boundDeleteBrandUser}>
                      <input type="hidden" name="userId" value={u.id} />
                      <ConfirmButton className="secondary" confirmText={`Remove ${u.email}'s access?`}>
                        Remove
                      </ConfirmButton>
                    </form>
                  </div>
                ))}
              </div>
            )}

            <div className="card" style={{ marginTop: 16, maxWidth: 480 }}>
              <form action={boundAddBrandUser} style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
                <label style={{ flex: 1 }}>
                  Email
                  <br />
                  <input name="email" type="email" required style={{ width: "100%" }} />
                </label>
                <label>
                  Role
                  <br />
                  <select name="role" defaultValue="client_teammate">
                    <option value="client_teammate">Teammate</option>
                    <option value="client_owner">Owner</option>
                  </select>
                </label>
                <button type="submit">Invite</button>
              </form>
              {!clientInfo.clerkOrgId && (
                <p style={{ marginTop: 8 }}>
                  <small style={{ color: "var(--muted)" }}>
                    {clientInfo.clientName} hasn't signed up via Clerk yet, so no invite email can be sent — this
                    just reserves their access for when they do.
                  </small>
                </p>
              )}
            </div>
          </div>
        </details>
      )}

      {isAdmin && (
        <details style={{ marginTop: 24 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, color: "#DC2626" }}>Danger zone</summary>
          <div style={{ marginTop: 12 }}>
            <p>
              <small>
                Permanently deletes {brandName} and everything tied to it — tasks, metrics, reports, connections.
                This cannot be undone. Use this when a brand offboards.
              </small>
            </p>
            <form action={boundDeleteBrand}>
              <ConfirmButton
                className="secondary"
                style={{ borderColor: "#DC2626", color: "#DC2626" }}
                confirmText={`Delete ${brandName} and ALL its data? This cannot be undone.`}
              >
                Delete this brand
              </ConfirmButton>
            </form>
          </div>
        </details>
      )}
    </main>
  );
}
