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
    <main style={{ padding: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>{ctx.role === "account_manager" ? "Your assigned clients" : "All clients (internal)"}</h1>
        <UserButton />
      </header>
      {ctx.role === "internal_admin" && (
        <p>
          <a href="/internal/assignments">Manage account manager assignments</a>
        </p>
      )}
      {rows.length === 0 ? (
        <p>{ctx.role === "account_manager" ? "No clients assigned to you yet." : "No clients yet."}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th>Brand</th>
              <th>Channels</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.brand_id}>
                <td>{r.client_name}</td>
                <td>{r.brand_name}</td>
                <td>{(r.channels_enabled as string[]).join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
