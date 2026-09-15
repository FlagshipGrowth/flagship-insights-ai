import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserContext, isOwner } from "@/lib/user-context";
import { getEmployeesForAssignment, getClientsForAssignment, getClientAssignmentMap, setClientAssignmentsForUser } from "@/lib/assignments";
import { getAllBrandsForPicker, getBrandAccessMap, setBrandAccessForUser } from "@/lib/brand-access";
import { AddClientsModal } from "@/components/AddClientsModal";
import { AddBrandModal } from "@/components/AddBrandModal";

async function setClientsAction(userId: string, formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  const clientIds = formData.getAll("clientId") as string[];
  await setClientAssignmentsForUser(userId, clientIds);
  revalidatePath("/internal/assignments");
  revalidatePath("/internal");
}

async function setBrandsAction(userId: string, formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  const brandIds = formData.getAll("brandId") as string[];
  await setBrandAccessForUser(userId, brandIds);
  revalidatePath("/internal/assignments");
  revalidatePath("/internal");
}

export default async function AssignmentsPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (!isOwner(ctx)) redirect("/internal");

  const [employees, clients, clientAssignmentMap, allBrands, brandAccessMap] = await Promise.all([
    getEmployeesForAssignment(),
    getClientsForAssignment(),
    getClientAssignmentMap(),
    getAllBrandsForPicker(),
    getBrandAccessMap(),
  ]);

  return (
    <main>
      <a href="/internal" className="back-link">
        &larr; Back
      </a>
      <h1 style={{ marginBottom: 4 }}>Employee assignments</h1>
      <p style={{ color: "var(--muted)", marginTop: 0, marginBottom: 24 }}>
        <small>
          Two ways to grant an employee access, per person: whole clients (every brand that client owns, including
          future ones) or individual brands. A visible brand can come from either.
        </small>
      </p>

      {employees.length === 0 ? (
        <p>No employees yet — invite one from /internal/employees, then they'll show up here.</p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Clients</th>
                <th>Brands</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => {
                const assignedClientIds = clientAssignmentMap.get(e.id) ?? [];
                const assignedBrandIds = brandAccessMap.get(e.id) ?? [];
                const boundSetClients = setClientsAction.bind(null, e.id);
                const boundSetBrands = setBrandsAction.bind(null, e.id);
                return (
                  <tr key={e.id}>
                    <td>{e.email}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {assignedClientIds.length > 0 ? (
                          <small>{assignedClientIds.length} assigned</small>
                        ) : (
                          <small style={{ color: "var(--muted)" }}>None</small>
                        )}
                        <AddClientsModal userLabel={e.email} clients={clients} selectedIds={assignedClientIds} action={boundSetClients} />
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {assignedBrandIds.length > 0 ? (
                          <small>{assignedBrandIds.length} assigned</small>
                        ) : (
                          <small style={{ color: "var(--muted)" }}>None</small>
                        )}
                        <AddBrandModal userLabel={e.email} brands={allBrands} selectedIds={assignedBrandIds} action={boundSetBrands} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
