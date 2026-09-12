import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserContext } from "@/lib/user-context";
import { getDb } from "@/lib/db";
import {
  getOpenTaskCountsByTeam,
  getAllTasksForAdmin,
  TASK_STATUSES,
  TASK_SORTS,
  type TaskSort,
} from "@/lib/tasks";
import { TEAMS } from "@/lib/teams";
import { TaskStatusSelect } from "@/components/TaskStatusSelect";
import { TaskTeamSelect } from "@/components/TaskTeamSelect";

const TASK_SORT_LABELS: Record<TaskSort, string> = {
  default: "Status",
  created_desc: "Newest created",
  created_asc: "Oldest created",
  due_date: "Most urgent",
};

async function updateTaskStatusAdmin(formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || ctx.role !== "internal_admin") return;

  const taskId = formData.get("taskId") as string;
  const status = formData.get("status") as string;
  if (!TASK_STATUSES.includes(status as any)) return;

  const sql = getDb();
  await sql`update tasks set status = ${status}, updated_at = now() where id = ${taskId}`;
  revalidatePath("/internal/tasks");
}

async function updateTaskTeamAdmin(formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || ctx.role !== "internal_admin") return;

  const taskId = formData.get("taskId") as string;
  const team = (formData.get("team") as string) || null;
  if (team && !(TEAMS as readonly string[]).includes(team)) return;

  const sql = getDb();
  await sql`update tasks set team = ${team}, updated_at = now() where id = ${taskId}`;
  revalidatePath("/internal/tasks");
}

export default async function AdminTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; team?: string; includeDone?: string }>;
}) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (ctx.role !== "internal_admin") redirect("/internal");

  const { sort: sortParam, team: teamParam, includeDone: includeDoneParam } = await searchParams;
  const sort: TaskSort = (TASK_SORTS as readonly string[]).includes(sortParam ?? "")
    ? (sortParam as TaskSort)
    : "due_date";
  const team = teamParam && (TEAMS as readonly string[]).includes(teamParam) ? teamParam : undefined;
  const includeDone = includeDoneParam === "1";

  const openCountsByTeam = await getOpenTaskCountsByTeam();
  const tasks = await getAllTasksForAdmin(sort, { team, includeDone });

  const linkParams = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { sort, team, includeDone: includeDone ? "1" : undefined, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value);
    }
    return `?${params.toString()}`;
  };

  return (
    <main>
      <a href="/internal" className="back-link">
        &larr; All brands
      </a>
      <h1 style={{ marginBottom: 24 }}>Tasks by team</h1>

      <section style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a
            href={linkParams({ team: undefined })}
            className="card"
            style={{ textDecoration: "none", minWidth: 120, ...(team ? {} : { borderColor: "var(--ink)" }) }}
          >
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--ink)" }}>
              {Object.values(openCountsByTeam).reduce((a, b) => a + b, 0)}
            </div>
            <small style={{ color: "var(--muted)" }}>All teams</small>
          </a>
          {TEAMS.map((t) => (
            <a
              key={t}
              href={linkParams({ team: t })}
              className="card"
              style={{ textDecoration: "none", minWidth: 120, ...(team === t ? { borderColor: "var(--ink)" } : {}) }}
            >
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--ink)" }}>
                {openCountsByTeam[t] ?? 0}
              </div>
              <small style={{ color: "var(--muted)" }}>{t}</small>
            </a>
          ))}
        </div>
      </section>

      <section>
        <nav className="pill-nav">
          {TASK_SORTS.map((s) => (
            <a key={s} href={linkParams({ sort: s })} className={s === sort ? "active" : ""}>
              {TASK_SORT_LABELS[s]}
            </a>
          ))}
        </nav>

        <p>
          <a href={linkParams({ includeDone: includeDone ? undefined : "1" })}>
            {includeDone ? "Hide done tasks" : "Show done tasks too"}
          </a>
        </p>

        {tasks.length === 0 ? (
          <p>No open tasks{team ? ` for ${team}` : ""}.</p>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table>
              <thead>
                <tr>
                  <th>Brand</th>
                  <th>Task</th>
                  <th>Team</th>
                  <th>Status</th>
                  <th>Assignee</th>
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
                    <td>
                      <TaskTeamSelect taskId={t.id} currentTeam={t.team} action={updateTaskTeamAdmin} />
                    </td>
                    <td>
                      <TaskStatusSelect taskId={t.id} currentStatus={t.status} action={updateTaskStatusAdmin} />
                    </td>
                    <td>{t.assignee ?? "—"}</td>
                    <td>
                      {t.dueDate ? (
                        <span
                          style={{
                            color: new Date(t.dueDate) < new Date() && t.status !== "done" ? "#DC2626" : undefined,
                          }}
                        >
                          {new Date(t.dueDate).toLocaleDateString()}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
