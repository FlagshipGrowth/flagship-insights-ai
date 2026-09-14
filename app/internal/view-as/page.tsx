import { redirect } from "next/navigation";
import { getUserContext, isOwner } from "@/lib/user-context";
import { getDb } from "@/lib/db";
import { startImpersonation } from "@/lib/impersonation";

interface Previewable {
  id: string;
  email: string;
  role: string;
  clientName: string | null;
}

async function getPreviewableAccounts(excludeUserId: string): Promise<Previewable[]> {
  const sql = getDb();
  const rows = await sql`
    select u.id, u.email, u.role, c.name as client_name
    from users u
    left join clients c on c.id = u.client_id
    where u.clerk_user_id is not null and u.id != ${excludeUserId}
    order by u.role, c.name, u.email
  `;
  return rows.map((r: any) => ({ id: r.id, email: r.email, role: r.role, clientName: r.client_name }));
}

export default async function ViewAsPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (!isOwner(ctx)) redirect("/internal");

  // Deliberately excludes internal_admin (the other owner) — "View as" previews the Employee and
  // Client tiers, not another owner's own Admin View.
  const accounts = await getPreviewableAccounts(ctx.id);
  const employees = accounts.filter((a) => a.role === "account_manager");
  const clients = accounts.filter((a) => a.role === "client_owner" || a.role === "client_teammate");

  const renderGroup = (title: string, rows: Previewable[]) => (
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ marginBottom: 8 }}>{title}</h2>
      {rows.length === 0 ? (
        <p>
          <small>None yet.</small>
        </p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden", maxWidth: 560 }}>
          <table>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>{a.email}</td>
                  <td>{a.clientName ?? "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    <form action={startImpersonation}>
                      <input type="hidden" name="userId" value={a.id} />
                      <button type="submit">View as →</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  return (
    <main>
      <a href="/internal" className="back-link">
        &larr; Back
      </a>
      <h1 style={{ marginBottom: 8 }}>View as</h1>
      <p style={{ marginBottom: 24 }}>
        <small>Preview the dashboard exactly as a specific employee or client sees it. Only accounts that have actually signed in are listed.</small>
      </p>

      {renderGroup("Employees", employees)}
      {renderGroup("Clients", clients)}
    </main>
  );
}
