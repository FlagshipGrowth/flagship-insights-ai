import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { getUserContext, isInternalStaff } from "@/lib/user-context";
import { getAllBrandsWithClients } from "@/lib/metrics";

export default async function InternalPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/sign-in");
  if (!isInternalStaff(ctx)) redirect("/dashboard");

  const rows = await getAllBrandsWithClients();

  return (
    <main style={{ padding: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>All clients (internal)</h1>
        <UserButton />
      </header>
      {ctx.role === "account_manager" && (
        <p style={{ color: "#a00" }}>
          Note: "assigned clients only" scoping for account managers isn't implemented yet — this
          shows every client, same as internal_admin (SPEC.md §2 open item). Don't rely on this
          view as an access boundary until that's built.
        </p>
      )}
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
    </main>
  );
}
