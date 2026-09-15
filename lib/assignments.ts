import { getDb } from "./db";

export interface AssignmentData {
  managers: { id: string; email: string }[];
  clients: { id: string; name: string }[];
  assignedSet: Set<string>;
}

/** Shared by /internal (the embedded "Employee assignments" section) and the standalone
 * /internal/assignments page — same clients x employees checkbox matrix either place. */
export async function getAssignmentData(): Promise<AssignmentData> {
  const sql = getDb();
  const managers = await sql`select id, email from users where role = 'account_manager' order by email`;
  const clients = await sql`select id, name from clients order by name`;
  const assignments = await sql`select user_id, client_id from account_manager_assignments`;
  return {
    managers: managers.map((m: any) => ({ id: m.id, email: m.email })),
    clients: clients.map((c: any) => ({ id: c.id, name: c.name })),
    assignedSet: new Set(assignments.map((a: any) => `${a.user_id}:${a.client_id}`)),
  };
}

/** Small admin-only table, low write frequency — replace-all is simpler and safer than diffing,
 * and there's no concurrent-edit concern at this scale. Caller is responsible for the isOwner()
 * gate (both call sites already check before invoking this). */
export async function saveAssignments(formData: FormData): Promise<void> {
  const sql = getDb();
  const pairs: { userId: string; clientId: string }[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("assign__") && value === "on") {
      const [, userId, clientId] = key.split("__");
      pairs.push({ userId, clientId });
    }
  }

  await sql`delete from account_manager_assignments`;
  for (const pair of pairs) {
    await sql`insert into account_manager_assignments (user_id, client_id) values (${pair.userId}, ${pair.clientId})`;
  }
}
