import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserContext, isInternalStaff, canStaffAccessBrand } from "@/lib/user-context";
import { getBrandMetrics, PERIODS, type Period } from "@/lib/metrics";
import { getBrandName } from "@/lib/seo";
import { getTasks, TASK_STATUSES } from "@/lib/tasks";
import { getDb } from "@/lib/db";
import { Badge } from "@/components/Badge";
import { TaskStatusSelect } from "./TaskStatusSelect";

async function createTask(brandId: string, formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isInternalStaff(ctx)) return;
  if (!(await canStaffAccessBrand(ctx, brandId))) return;

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const assignee = (formData.get("assignee") as string)?.trim() || null;
  const dueDate = (formData.get("dueDate") as string) || null;
  if (!title) return;

  const sql = getDb();
  await sql`
    insert into tasks (brand_id, title, description, assignee, due_date, created_by)
    values (${brandId}, ${title}, ${description}, ${assignee}, ${dueDate}, ${ctx.id})
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
  await sql`update tasks set status = ${status}, updated_at = now() where id = ${taskId} and brand_id = ${brandId}`;
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

export default async function BrandHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { brandId } = await params;
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (!isInternalStaff(ctx)) redirect("/dashboard");
  if (!(await canStaffAccessBrand(ctx, brandId))) redirect("/internal");

  const brandName = await getBrandName(brandId);
  if (!brandName) redirect("/internal");

  const { period: periodParam } = await searchParams;
  const period: Period = (PERIODS as string[]).includes(periodParam ?? "") ? (periodParam as Period) : "mtd";

  const metrics = await getBrandMetrics(brandId, period);
  const tasks = await getTasks(brandId);
  const boundCreateTask = createTask.bind(null, brandId);
  const boundUpdateStatus = updateTaskStatus.bind(null, brandId);
  const boundDeleteTask = deleteTask.bind(null, brandId);

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
          <div className="card" style={{ padding: 0, overflow: "hidden", maxWidth: 640 }}>
            <table>
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Metric</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((m: any, i: number) => (
                  <tr key={i}>
                    <td>{m.channel}</td>
                    <td>{m.metric_key}</td>
                    <td>{m.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>Tools</h2>
        <div className="card" style={{ maxWidth: 640, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Product optimizations (SEO)</span>
          <a href={`/internal/seo/${brandId}`}>Open →</a>
        </div>
      </section>

      <section>
        <h2>Tasks</h2>
        <div className="card" style={{ marginBottom: 16, maxWidth: 640 }}>
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

        {tasks.length === 0 ? (
          <p>No tasks yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 }}>
            {tasks.map((t: any) => (
              <div key={t.id} className="card" style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <strong>{t.title}</strong>
                    <Badge variant={t.status}>{t.status.replace("_", " ")}</Badge>
                  </div>
                  {t.description && <p style={{ margin: "4px 0" }}>{t.description}</p>}
                  <small>
                    {t.assignee ? `${t.assignee}` : "Unassigned"}
                    {t.due_date ? ` · due ${new Date(t.due_date).toLocaleDateString()}` : ""}
                  </small>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                  <TaskStatusSelect taskId={t.id} currentStatus={t.status} action={boundUpdateStatus} />
                  <form action={boundDeleteTask}>
                    <input type="hidden" name="taskId" value={t.id} />
                    <button type="submit" className="secondary">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
