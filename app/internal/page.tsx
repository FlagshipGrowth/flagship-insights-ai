import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { getUserContext, isInternalStaff } from "@/lib/user-context";
import { getAllBrandsWithClients, getAssignedBrandsWithClients } from "@/lib/metrics";
import { getOpenTaskCountsByTeam } from "@/lib/tasks";
import { getPendingUsersCount } from "@/lib/user-approvals";
import { TEAMS } from "@/lib/teams";
import { Badge } from "@/components/Badge";

export default async function InternalPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (!isInternalStaff(ctx)) redirect("/dashboard");

  const rows =
    ctx.role === "account_manager" ? await getAssignedBrandsWithClients(ctx.id) : await getAllBrandsWithClients();
  const openCountsByTeam = ctx.role === "internal_admin" ? await getOpenTaskCountsByTeam() : null;
  const pendingUsersCount = ctx.role === "internal_admin" ? await getPendingUsersCount() : 0;

  return (
    <main>
      {openCountsByTeam && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ marginBottom: 8 }}>Tasks by team</h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a href="/internal/tasks" className="card" style={{ textDecoration: "none", minWidth: 120 }}>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--ink)" }}>
                {Object.values(openCountsByTeam).reduce((a, b) => a + b, 0)}
              </div>
              <small style={{ color: "var(--muted)" }}>All teams</small>
            </a>
            {TEAMS.map((t) => (
              <a
                key={t}
                href={`/internal/tasks?team=${encodeURIComponent(t)}`}
                className="card"
                style={{ textDecoration: "none", minWidth: 120 }}
              >
                <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--ink)" }}>{openCountsByTeam[t] ?? 0}</div>
                <small style={{ color: "var(--muted)" }}>{t}</small>
              </a>
            ))}
          </div>
        </section>
      )}

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1>{ctx.role === "account_manager" ? "Your assigned brands" : "Choose a brand"}</h1>
        <UserButton />
      </header>

      <nav className="top-nav">
        <a href="/internal/my-tasks">My tasks</a>
        {ctx.role === "internal_admin" && (
          <>
            <a href="/internal/brands/new">Add new brand</a>
            <a href="/internal/assignments">Manage account manager assignments</a>
            <a href="/internal/tasks">Tasks by team</a>
            <a href="/internal/approvals">
              Sign Up Approval{pendingUsersCount > 0 && <Badge variant="pending"> {pendingUsersCount}</Badge>}
            </a>
          </>
        )}
      </nav>

      {ctx.role === "account_manager" && (
        <p style={{ color: "var(--muted)" }}>
          <small>
            Note: "assigned clients only" scoping isn't fully audited yet — flag anything that looks off.
          </small>
        </p>
      )}

      {rows.length === 0 ? (
        <p>{ctx.role === "account_manager" ? "No clients assigned to you yet." : "No clients yet."}</p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Brand</th>
                <th>Channels</th>
                <th>Open tasks</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => {
                const openTaskCount = Number(r.open_task_count);
                return (
                  <tr key={r.brand_id}>
                    <td>{r.client_name}</td>
                    <td>{r.brand_name}</td>
                    <td>{(r.channels_enabled as string[]).join(", ") || "—"}</td>
                    <td>
                      {openTaskCount > 0 ? (
                        <Badge variant="pending">
                          {openTaskCount} open task{openTaskCount === 1 ? "" : "s"}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <a href={`/internal/brand/${r.brand_id}`}>Open →</a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
