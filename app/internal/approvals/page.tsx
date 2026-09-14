import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserContext } from "@/lib/user-context";
import { getPendingUsers, approveUser } from "@/lib/user-approvals";
import { Badge } from "@/components/Badge";

async function approveUserAction(formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  // Deliberately internal_admin only, not isInternalStaff (which also allows account_manager) —
  // sign-up approval is an admin-only action.
  if (!ctx || ctx.role !== "internal_admin") return;

  const userId = formData.get("userId") as string;
  if (!userId) return;
  await approveUser(userId);
  revalidatePath("/internal/approvals");
  revalidatePath("/internal");
}

export default async function ApprovalsPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (ctx.role !== "internal_admin") redirect("/internal");

  const pending = await getPendingUsers();

  return (
    <main>
      <a href="/internal" className="back-link">
        &larr; Back
      </a>
      <h1 style={{ marginBottom: 24 }}>Sign Up Approval</h1>

      {pending.length === 0 ? (
        <p>No sign-ups waiting on approval.</p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden", maxWidth: 720 }}>
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Client</th>
                <th>Role</th>
                <th>Signed up</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{u.clientName ?? "—"}</td>
                  <td>
                    <Badge variant="pending">{u.role.replace("_", " ")}</Badge>
                  </td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td>
                    <form action={approveUserAction}>
                      <input type="hidden" name="userId" value={u.id} />
                      <button type="submit">Approve</button>
                    </form>
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
