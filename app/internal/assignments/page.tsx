import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserContext, isOwner } from "@/lib/user-context";
import { getAssignmentData, saveAssignments } from "@/lib/assignments";

async function saveAssignmentsAction(formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;

  await saveAssignments(formData);
  revalidatePath("/internal/assignments");
  revalidatePath("/internal");
}

export default async function AssignmentsPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (!isOwner(ctx)) redirect("/internal");

  const { managers, clients, assignedSet } = await getAssignmentData();

  return (
    <main>
      <a href="/internal" className="back-link">
        &larr; Back
      </a>
      <h1 style={{ marginBottom: 24 }}>Employee assignments</h1>
      {managers.length === 0 ? (
        <p>No employees yet — invite one from /internal/employees, then they'll show up here.</p>
      ) : clients.length === 0 ? (
        <p>No clients yet.</p>
      ) : (
        <form action={saveAssignmentsAction}>
          <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  {managers.map((m) => (
                    <th key={m.id}>{m.email}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    {managers.map((m) => (
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
          </div>
          <button type="submit">Save assignments</button>
        </form>
      )}
    </main>
  );
}
