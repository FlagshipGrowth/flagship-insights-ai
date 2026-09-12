import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserContext, isInternalStaff, canStaffAccessBrand } from "@/lib/user-context";
import { getBrandMetrics, getBrandMetricsTimeSeries, PERIODS, type Period } from "@/lib/metrics";
import { getBrandName } from "@/lib/seo";
import { getBrandReportLinks, getInventoryPreview, getReconciliationSummary } from "@/lib/reports";
import {
  getTasks,
  getTaskCommentsForBrand,
  logTaskActivity,
  TASK_STATUSES,
  TASK_SORTS,
  type TaskSort,
} from "@/lib/tasks";
import { getBrandSlackChannelId } from "@/lib/brands";
import { TEAMS } from "@/lib/teams";
import { getDb } from "@/lib/db";
import { Badge } from "@/components/Badge";
import { MetricsChart } from "@/components/MetricsChart";
import { InventoryPreviewCard } from "@/components/InventoryPreviewCard";
import { ReconciliationPreviewCard } from "@/components/ReconciliationPreviewCard";
import { TaskCard } from "./TaskCard";

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
  if (!title) return;
  if (team && !(TEAMS as readonly string[]).includes(team)) return;

  const sql = getDb();
  await sql`
    insert into tasks (brand_id, title, description, assignee, team, due_date, created_by)
    values (${brandId}, ${title}, ${description}, ${assignee}, ${team}, ${dueDate}, ${ctx.id})
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
  const before = await sql`select team from tasks where id = ${taskId} and brand_id = ${brandId}`;
  if (before.length === 0 || before[0].team === team) return;

  await sql`update tasks set team = ${team}, updated_at = now() where id = ${taskId} and brand_id = ${brandId}`;
  await logTaskActivity(taskId, ctx.email, `changed team to ${team ?? "unassigned"}`);
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

export default async function BrandHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>;
  searchParams: Promise<{ period?: string; taskSort?: string }>;
}) {
  const { brandId } = await params;
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (!isInternalStaff(ctx)) redirect("/dashboard");
  if (!(await canStaffAccessBrand(ctx, brandId))) redirect("/internal");

  const brandName = await getBrandName(brandId);
  if (!brandName) redirect("/internal");

  const { period: periodParam, taskSort: taskSortParam } = await searchParams;
  const period: Period = (PERIODS as string[]).includes(periodParam ?? "") ? (periodParam as Period) : "mtd";
  const taskSort: TaskSort = (TASK_SORTS as readonly string[]).includes(taskSortParam ?? "")
    ? (taskSortParam as TaskSort)
    : "default";

  const metrics = await getBrandMetrics(brandId, period);
  const metricsSeries = await getBrandMetricsTimeSeries(brandId, period);
  const { weeklyReportUrls, inventoryReportUrls, reconciliationReportUrls } = await getBrandReportLinks(brandId);
  const inventoryPreview = await getInventoryPreview(brandId);
  const reconciliationSummary = await getReconciliationSummary(brandId);
  const tasks = await getTasks(brandId, taskSort);
  const comments = await getTaskCommentsForBrand(brandId);
  const commentsByTask = new Map<string, typeof comments>();
  for (const c of comments) {
    if (!commentsByTask.has(c.taskId)) commentsByTask.set(c.taskId, []);
    commentsByTask.get(c.taskId)!.push(c);
  }
  const slackChannelId = await getBrandSlackChannelId(brandId);
  const tasksByCategory = new Map<string, typeof tasks>();
  for (const t of tasks as any[]) {
    const key = t.category ?? "Other";
    if (!tasksByCategory.has(key)) tasksByCategory.set(key, []);
    tasksByCategory.get(key)!.push(t);
  }
  const boundCreateTask = createTask.bind(null, brandId);
  const boundUpdateStatus = updateTaskStatus.bind(null, brandId);
  const boundUpdateTeam = updateTaskTeam.bind(null, brandId);
  const boundUpdateDueDate = updateTaskDueDate.bind(null, brandId);
  const boundDeleteTask = deleteTask.bind(null, brandId);
  const boundAddComment = addTaskComment.bind(null, brandId);
  const boundUpdateSlackChannel = updateSlackChannel.bind(null, brandId);

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
        <h2>Tools</h2>
        <div className="card" style={{ maxWidth: 640, padding: 0, overflow: "hidden" }}>
          {[
            { label: "Product optimizations (SEO)", href: `/internal/seo/${brandId}`, available: true },
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

      <section>
        <h2>Tasks</h2>

        <nav className="pill-nav">
          {TASK_SORTS.map((s) => (
            <a
              key={s}
              href={`/internal/brand/${brandId}?period=${period}&taskSort=${s}`}
              className={s === taskSort ? "active" : ""}
            >
              {TASK_SORT_LABELS[s]}
            </a>
          ))}
        </nav>

        {tasks.length === 0 ? (
          <p>No tasks yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 640 }}>
            {Array.from(tasksByCategory.entries()).map(([category, categoryTasks]) => (
              <div key={category}>
                <h3 style={{ marginBottom: 8 }}>{category}</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {(categoryTasks as any[]).map((t: any) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      comments={commentsByTask.get(t.id) ?? []}
                      boundUpdateStatus={boundUpdateStatus}
                      boundUpdateTeam={boundUpdateTeam}
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
    </main>
  );
}
