import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { getUserContext, isInternalStaff } from "@/lib/user-context";
import { getAllBrandsWithClients, getAssignedBrandsWithClients } from "@/lib/metrics";

export default async function InternalPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (!isInternalStaff(ctx)) redirect("/dashboard");

  const rows =
    ctx.role === "account_manager" ? await getAssignedBrandsWithClients(ctx.id) : await getAllBrandsWithClients();

  return (
    <main>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1>{ctx.role === "account_manager" ? "Your assigned brands" : "Choose a brand"}</h1>
        <UserButton />
      </header>

      {ctx.role === "internal_admin" && (
        <nav className="top-nav">
          <a href="/internal/assignments">Manage account manager assignments</a>
        </nav>
      )}

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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.brand_id}>
                  <td>{r.client_name}</td>
                  <td>{r.brand_name}</td>
                  <td>{(r.channels_enabled as string[]).join(", ") || "—"}</td>
                  <td>
                    <a href={`/internal/brand/${r.brand_id}`}>Open →</a>
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
