import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserContext, isInternalStaff, isOwner } from "@/lib/user-context";
import { getAllBrandsWithClients, getAssignedBrandsWithClients } from "@/lib/metrics";
import { getOpenTaskCountsByTeam } from "@/lib/tasks";
import { getPendingUsersCount, getManagedUsers, approveUser, removeManagedUser } from "@/lib/user-approvals";
import { deleteBrand as deleteBrandRow } from "@/lib/brands";
import { getAllBrandsForPicker, getBrandAccessMap, setBrandAccessForUser } from "@/lib/brand-access";
import { TEAMS } from "@/lib/teams";
import { Badge } from "@/components/Badge";
import { ConfirmButton } from "@/components/ConfirmButton";
import { AddBrandModal } from "@/components/AddBrandModal";

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

async function removeManagedUserAction(userId: string, role: string) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  await removeManagedUser(userId, role);
  revalidatePath("/internal");
}

async function setBrandAccessAction(userId: string, formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  const brandIds = formData.getAll("brandId") as string[];
  await setBrandAccessForUser(userId, brandIds);
  revalidatePath("/internal");
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
  const managedUsers = owner ? await getManagedUsers() : [];
  const allBrands = owner ? await getAllBrandsForPicker() : [];
  const brandAccessMap = owner ? await getBrandAccessMap() : new Map<string, string[]>();

  return (
    <main>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>{ctx.role === "account_manager" ? "Your assigned brands" : "Admin"}</h1>
      </header>

      <section style={{ marginBottom: 32 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          {!owner && <ActionCard href="/internal/my-tasks" title="My tasks" subtitle="Tasks assigned to you" />}
          {owner && (
            <>
              <ActionCard href="/internal/brands/new" title="Add new brand" subtitle="Set up a brand for a client" />
              <ActionCard href="/internal/employees" title="Manage employees" subtitle="Invite staff, assign clients" />
              <ActionCard href="/internal/crm" title="CRM" subtitle="New-business sales pipeline" />
              <ActionCard href="/internal/marketing" title="Marketing Efforts" subtitle="Meta Ads performance" />
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
              Client sign-ups and employees together. A client sign-up can't be approved until they can see at
              least one brand — use Add Brand to grant a user access to any existing brand (multiple users, even
              across different clients, can be granted the same one). New brands themselves are still created from
              Add new brand above, never automatically at sign-up.
            </small>
          </p>

          {managedUsers.length === 0 ? (
            <p>No users yet.</p>
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
                      <th style={{ position: "sticky", top: 0, background: "#fff" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {managedUsers.map((u) => {
                      const isClientUser = u.role === "client_owner" || u.role === "client_teammate";
                      const boundApprove = approveUserAction.bind(null, u.id);
                      const boundRemove = removeManagedUserAction.bind(null, u.id, u.role);
                      const boundSetBrandAccess = setBrandAccessAction.bind(null, u.id);
                      const selectedBrandIds = brandAccessMap.get(u.id) ?? [];
                      return (
                        <tr key={u.id}>
                          <td>{u.email}</td>
                          <td>{u.clientName ?? "—"}</td>
                          <td>{u.role === "account_manager" ? "employee" : "client"}</td>
                          <td>
                            {isClientUser ? (
                              <Badge variant={u.status}>{u.status}</Badge>
                            ) : u.hasClerkAccount ? (
                              <Badge variant="approved">active</Badge>
                            ) : (
                              <Badge variant="pending">invited</Badge>
                            )}
                          </td>
                          <td>
                            {isClientUser ? (
                              u.brandCount > 0 ? (
                                u.brandCount
                              ) : (
                                <Badge variant="pending">No brand yet</Badge>
                              )
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>
                            <AddBrandModal
                              userLabel={u.email}
                              brands={allBrands}
                              selectedIds={selectedBrandIds}
                              action={boundSetBrandAccess}
                            />
                          </td>
                          <td>
                            {isClientUser && u.status === "pending" && u.brandCount > 0 && (
                              <form action={boundApprove}>
                                <button type="submit">Approve</button>
                              </form>
                            )}
                          </td>
                          <td>
                            <form action={boundRemove}>
                              <ConfirmButton
                                className="secondary"
                                style={{ borderColor: "#DC2626", color: "#DC2626" }}
                                confirmText={`Remove ${u.email}'s access entirely? This cannot be undone.`}
                              >
                                Remove
                              </ConfirmButton>
                            </form>
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
