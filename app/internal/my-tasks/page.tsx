import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserContext, isInternalStaff, deriveNameFromEmail } from "@/lib/user-context";
import { getOpenTasksForAssignee, logTaskActivity, TASK_STATUSES } from "@/lib/tasks";
import { getDb } from "@/lib/db";
import { TaskStatusSelect } from "@/components/TaskStatusSelect";
import { parseDateOnly } from "@/lib/dates";

const PRIORITY_LABELS: Record<string, string> = { high: "High", med: "Medium", low: "Low" };

/**
 * Self-scoped status update for the "My Tasks" dashboard — authorization here is "does this
 * task's assignee match my own derived name" (see lib/user-context.ts's deriveNameFromEmail),
 * not the canStaffAccessBrand/internal_admin checks used everywhere else, since this page shows
 * a person's own tasks across brands they may not otherwise have access to.
 */
async function updateMyTaskStatus(formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isInternalStaff(ctx)) return;

  const taskId = formData.get("taskId") as string;
  const status = formData.get("status") as string;
  if (!TASK_STATUSES.includes(status as any)) return;

  const myName = deriveNameFromEmail(ctx.email);
  const sql = getDb();
  const before = await sql`select status, assignee from tasks where id = ${taskId}`;
  if (before.length === 0 || before[0].status === status) return;
  if (String(before[0].assignee ?? "").toLowerCase() !== myName.toLowerCase()) return;

  await sql`update tasks set status = ${status}, updated_at = now() where id = ${taskId}`;
  await logTaskActivity(
    taskId,
    ctx.email,
    `changed status from ${before[0].status.replace("_", " ")} to ${status.replace("_", " ")}`
  );
  revalidatePath("/internal/my-tasks");
}

export default async function MyTasksPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (!isInternalStaff(ctx)) redirect("/dashboard");

  const myName = deriveNameFromEmail(ctx.email);
  const tasks = await getOpenTasksForAssignee(myName);

  return (
    <main>
      <a href="/internal" className="back-link">
        &larr; All brands
      </a>
      <h1 style={{ marginBottom: 8 }}>My tasks</h1>
      <p style={{ marginBottom: 24 }}>
        <small style={{ color: "var(--muted)" }}>
          Open tasks assigned to {myName}, across every brand, ranked by priority.
        </small>
      </p>

      {tasks.length === 0 ? (
        <p>No open tasks assigned to you right now.</p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table>
            <thead>
              <tr>
                <th>Brand</th>
                <th>Task</th>
                <th>Team</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Due date</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td>
                    <a href={`/internal/brand/${t.brandId}`}>{t.brandName}</a>
                  </td>
                  <td>
                    {t.title}
                    {t.category && (
                      <>
                        {" "}
                        <small style={{ color: "var(--muted)" }}>({t.category})</small>
                      </>
                    )}
                  </td>
                  <td>{t.team ?? "—"}</td>
                  <td>{t.priority ? PRIORITY_LABELS[t.priority] ?? t.priority : "—"}</td>
                  <td>
                    <TaskStatusSelect taskId={t.id} currentStatus={t.status} action={updateMyTaskStatus} />
                  </td>
                  <td>
                    <span
                      style={{
                        color: t.dueDate && parseDateOnly(t.dueDate) < new Date() ? "#DC2626" : undefined,
                      }}
                    >
                      {t.dueDate ? parseDateOnly(t.dueDate).toLocaleDateString() : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
