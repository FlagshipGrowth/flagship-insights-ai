import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { UserButton } from "@clerk/nextjs";
import { getUserContext, isInternalStaff, isOwner } from "@/lib/user-context";
import { getAllBrandsWithClients, getAssignedBrandsWithClients } from "@/lib/metrics";
import { getOpenTaskCountsByTeam } from "@/lib/tasks";
import { getPendingUsersCount, getClientUsers, approveUser } from "@/lib/user-approvals";
import { deleteBrand as deleteBrandRow } from "@/lib/brands";
import { getAssignmentData, saveAssignments } from "@/lib/assignments";
import { TEAMS } from "@/lib/teams";
import { Badge } from "@/components/Badge";
import { ConfirmButton } from "@/components/ConfirmButton";

async function deleteBrandAction(brandId: string) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  await deleteBrandRow(brandId);
  revalidatePath("/internal");
}

async function approveUserAction(userId: string) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  await approveUser(userId);
  revalidatePath("/internal");
}

async function saveAssignmentsAction(formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  await saveAssignments(formData);
  revalidatePath("/internal");
  revalidatePath("/internal/assignments");
}

function ActionCard({ href, title, subtitle }: { href: string; title: React.ReactNode; subtitle: string }) {
  return (
    <a
      href={href}
      className="card"
      style={{ textDecoration: "none", color: "var(--ink)", display: "block", transition: "border-color 0.15s" }}
    >
      <div style={{ fontFamily: "var(--font-heading), system-ui, sans-serif", fontWeight: 700, marginBottom: 4 }}>
        {title}
      </div>
      <small style={{ color: "var(--muted)" }}>{subtitle}</small>
    </a>
  );
}

export default async function InternalPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (!isInternalStaff(ctx)) redirect("/dashboard");

  const rows =
    ctx.role === "account_manager" ? await getAssignedBrandsWithClients(ctx.id) : await getAllBrandsWithClients();
  const openCountsByTeam = isOwner(ctx) ? await getOpenTaskCountsByTeam() : null;
  const pendingUsersCount = isOwner(ctx) ? await getPendingUsersCount() : 0;
  const owner = isOwner(ctx);
  const clientUsers = owner ? await getClientUsers() : [];
  const assignmentData = owner ? await getAssignmentData() : null;

  return (
    <main>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>{ctx.role === "account_manager" ? "Your assigned brands" : "Admin"}</h1>
        <UserButton />
      </header>

      <section style={{ marginBottom: 32 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          <ActionCard href="/internal/my-tasks" title="My tasks" subtitle="Tasks assigned to you" />
          {owner && (
            <>
              <ActionCard href="/internal/brands/new" title="Add new brand" subtitle="Set up a brand for a client" />
              <ActionCard href="/internal/employees" title="Manage employees" subtitle="Invite staff, assign clients" />
              <ActionCard
                href="/internal/approvals"
                title={
                  <>
                    Sign Up Approval{pendingUsersCount > 0 && <Badge variant="pending"> {pendingUsersCount}</Badge>}
                  </>
                }
                subtitle="Review new client sign-ups"
              />
            </>
          )}
        </div>
        {owner && (
          <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
            <a href="/internal/view-as">View as</a>
          </div>
        )}
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ marginBottom: 8 }}>{ctx.role === "account_manager" ? "Your assigned brands" : "Choose a brand"}</h2>
        {ctx.role === "account_manager" && (
          <p style={{ color: "var(--muted)", marginTop: 0 }}>
            <small>
              Note: "assigned clients only" scoping isn't fully audited yet — flag anything that looks off.
            </small>
          </p>
        )}

        {rows.length === 0 ? (
          <p>{ctx.role === "account_manager" ? "No clients assigned to you yet." : "No clients yet."}</p>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ position: "sticky", top: 0, background: "#fff" }}>Client</th>
                    <th style={{ position: "sticky", top: 0, background: "#fff" }}>Brand</th>
                    <th style={{ position: "sticky", top: 0, background: "#fff" }}>Channels</th>
                    <th style={{ position: "sticky", top: 0, background: "#fff" }}>Open tasks</th>
                    <th style={{ position: "sticky", top: 0, background: "#fff" }}></th>
                    {owner && <th style={{ position: "sticky", top: 0, background: "#fff" }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => {
                    const openTaskCount = Number(r.open_task_count);
                    const boundDelete = deleteBrandAction.bind(null, r.brand_id);
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
                        {owner && (
                          <td>
                            <form action={boundDelete}>
                              <ConfirmButton
                                className="secondary"
                                style={{ borderColor: "#DC2626", color: "#DC2626" }}
                                confirmText={`Delete ${r.brand_name} and ALL its data? This cannot be undone.`}
                              >
                                Delete
                              </ConfirmButton>
                            </form>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {owner && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ marginBottom: 8 }}>Manage users</h2>
          <p style={{ color: "var(--muted)", marginTop: 0 }}>
            <small>
              A client sign-up can't be approved until their client has at least one brand — brands are created here,
              never automatically at sign-up.
            </small>
          </p>

          {clientUsers.length === 0 ? (
            <p>No client users yet.</p>
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ position: "sticky", top: 0, background: "#fff" }}>Email</th>
                      <th style={{ position: "sticky", top: 0, background: "#fff" }}>Client</th>
                      <th style={{ position: "sticky", top: 0, background: "#fff" }}>Role</th>
                      <th style={{ position: "sticky", top: 0, background: "#fff" }}>Status</th>
                      <th style={{ position: "sticky", top: 0, background: "#fff" }}>Brands</th>
                      <th style={{ position: "sticky", top: 0, background: "#fff" }}></th>
                      <th style={{ position: "sticky", top: 0, background: "#fff" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientUsers.map((u) => {
                      const boundApprove = approveUserAction.bind(null, u.id);
                      return (
                        <tr key={u.id}>
                          <td>{u.email}</td>
                          <td>{u.clientName ?? "—"}</td>
                          <td>{u.role.replace("_", " ")}</td>
                          <td>
                            <Badge variant={u.status}>{u.status}</Badge>
                          </td>
                          <td>{u.brandCount > 0 ? u.brandCount : <Badge variant="pending">No brand yet</Badge>}</td>
                          <td>
                            <a href={`/internal/brands/new?clientId=${u.clientId ?? ""}`}>Add Brand</a>
                          </td>
                          <td>
                            {u.status === "pending" && u.brandCount > 0 && (
                              <form action={boundApprove}>
                                <button type="submit">Approve</button>
                              </form>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {assignmentData && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ marginBottom: 8 }}>Employee assignments</h2>
          <p style={{ color: "var(--muted)", marginTop: 0 }}>
            <small>Which employees can see which clients — controls the "assigned brands" scoping on their own view.</small>
          </p>

          {assignmentData.managers.length === 0 ? (
            <p>No employees yet — invite one from Manage employees, then they'll show up here.</p>
          ) : assignmentData.clients.length === 0 ? (
            <p>No clients yet.</p>
          ) : (
            <form action={saveAssignmentsAction}>
              <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 12 }}>
                <div style={{ maxHeight: 400, overflowY: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ position: "sticky", top: 0, background: "#fff" }}>Client</th>
                        {assignmentData.managers.map((m) => (
                          <th key={m.id} style={{ position: "sticky", top: 0, background: "#fff" }}>
                            {m.email}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {assignmentData.clients.map((c) => (
                        <tr key={c.id}>
                          <td>{c.name}</td>
                          {assignmentData.managers.map((m) => (
                            <td key={m.id} style={{ textAlign: "center" }}>
                              <input
                                type="checkbox"
                                name={`assign__${m.id}__${c.id}`}
                                defaultChecked={assignmentData.assignedSet.has(`${m.id}:${c.id}`)}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <button type="submit">Save assignments</button>
            </form>
          )}
        </section>
      )}

      {openCountsByTeam && (
        <section>
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
    </main>
  );
}
