import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserContext } from "@/lib/user-context";
import { getDb } from "@/lib/db";

async function saveAssignments(formData: FormData) {
  "use server";
  const sql = getDb();

  const pairs: { userId: string; clientId: string }[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("assign__") && value === "on") {
      const [, userId, clientId] = key.split("__");
      pairs.push({ userId, clientId });
    }
  }

  // Small admin-only table, low write frequency — replace-all is simpler and safer than
  // diffing, and there's no concurrent-edit concern at this scale.
  await sql`delete from account_manager_assignments`;
  for (const pair of pairs) {
    await sql`insert into account_manager_assignments (user_id, client_id) values (${pair.userId}, ${pair.clientId})`;
  }

  revalidatePath("/internal/assignments");
  revalidatePath("/internal");
}

export default async function AssignmentsPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (ctx.role !== "internal_admin") redirect("/internal");

  const sql = getDb();
  const managers = await sql`select id, email from users where role = 'account_manager' order by email`;
  const clients = await sql`select id, name from clients order by name`;
  const assignments = await sql`select user_id, client_id from account_manager_assignments`;
  const assignedSet = new Set(assignments.map((a: any) => `${a.user_id}:${a.client_id}`));

  return (
    <main style={{ padding: 24 }}>
      <h1>Account manager assignments</h1>
      <p>
        <a href="/internal">&larr; Back</a>
      </p>
      {managers.length === 0 ? (
        <p>No users with the account_manager role yet — they show up here once they sign up and someone sets their role.</p>
      ) : clients.length === 0 ? (
        <p>No clients yet.</p>
      ) : (
        <form action={saveAssignments}>
          <table>
            <thead>
              <tr>
                <th>Client</th>
                {managers.map((m: any) => (
                  <th key={m.id}>{m.email}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map((c: any) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  {managers.map((m: any) => (
                    <td key={m.id} style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        name={`assign__${m.id}__${c.id}`}
                        defaultChecked={assignedSet.has(`${m.id}:${c.id}`)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <button type="submit" style={{ marginTop: 16 }}>
            Save assignments
          </button>
        </form>
      )}
    </main>
  );
}
