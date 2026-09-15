import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { getUserContext, isOwner } from "@/lib/user-context";
import { getEmployees, removeEmployeeRow } from "@/lib/employees";
import { getDb } from "@/lib/db";
import { Badge } from "@/components/Badge";

async function inviteEmployee(formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  if (!email) return;

  const sql = getDb();
  // Pre-provision, same shape as addBrandUser's client-teammate pattern — clerk_user_id left
  // null until they actually sign up (linked in app/api/webhooks/clerk/route.ts's user.created).
  // status is 'approved' immediately: an owner personally chose this person, so this never goes
  // through the /internal/approvals sign-up-approval queue.
  await sql`
    insert into users (client_id, role, email, status)
    values (null, 'account_manager', ${email}, 'approved')
    on conflict (email) do update set role = 'account_manager', status = 'approved'
  `;

  try {
    const clerk = await clerkClient();
    await clerk.invitations.createInvitation({ emailAddress: email, redirectUrl: "/sign-up" });
  } catch (err) {
    // The users row is what actually matters (it's what gets linked on sign-up) — a failed
    // invitation email just means whoever invited them needs to share the sign-up link directly.
    console.error(`Clerk invitation failed for ${email}: ${err instanceof Error ? err.message : err}`);
  }

  revalidatePath("/internal/employees");
}

async function removeEmployee(formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;

  const userId = formData.get("userId") as string;
  if (!userId) return;

  await removeEmployeeRow(userId);
  revalidatePath("/internal/employees");
  revalidatePath("/internal");
}

export default async function EmployeesPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (!isOwner(ctx)) redirect("/internal");

  const employees = await getEmployees();

  return (
    <main>
      <a href="/internal" className="back-link">
        &larr; Back
      </a>
      <h1 style={{ marginBottom: 24 }}>Employees</h1>

      <section className="card" style={{ marginBottom: 24, maxWidth: 480 }}>
        <h2>Invite an employee</h2>
        <form action={inviteEmployee} style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          <label style={{ flex: 1 }}>
            Email
            <br />
            <input type="email" name="email" required style={{ width: "100%" }} />
          </label>
          <button type="submit">Invite</button>
        </form>
      </section>

      {employees.length === 0 ? (
        <p>No employees yet.</p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden", maxWidth: 720 }}>
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Status</th>
                <th>Assigned clients</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td>{e.email}</td>
                  <td>
                    {e.hasClerkAccount ? (
                      "Active"
                    ) : (
                      <Badge variant="pending">Invited — not signed in yet</Badge>
                    )}
                  </td>
                  <td>{e.assignedClientNames.length > 0 ? e.assignedClientNames.join(", ") : "—"}</td>
                  <td>
                    <form action={removeEmployee}>
                      <input type="hidden" name="userId" value={e.id} />
                      <button type="submit">Remove</button>
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
