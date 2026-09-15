import { getDb } from "./db";

export interface AssignableEmployee {
  id: string;
  email: string;
}

export interface AssignableClient {
  id: string;
  name: string;
}

export async function getEmployeesForAssignment(): Promise<AssignableEmployee[]> {
  const sql = getDb();
  const rows = await sql`select id, email from users where role = 'account_manager' order by email`;
  return rows.map((r: any) => ({ id: r.id, email: r.email }));
}

export async function getClientsForAssignment(): Promise<AssignableClient[]> {
  const sql = getDb();
  const rows = await sql`select id, name from clients order by name`;
  return rows.map((r: any) => ({ id: r.id, name: r.name }));
}

/** Every assignment, grouped by employee — for the assignments table, so it can show each row's
 * current picks without an N+1 query per row. Same convention as getBrandAccessMap. */
export async function getClientAssignmentMap(): Promise<Map<string, string[]>> {
  const sql = getDb();
  const rows = await sql`select user_id, client_id from account_manager_assignments`;
  const map = new Map<string, string[]>();
  for (const r of rows as any[]) {
    const list = map.get(r.user_id) ?? [];
    list.push(r.client_id);
    map.set(r.user_id, list);
  }
  return map;
}

/** Replace-all for one employee only — assigns them to every client picked, granting them all of
 * that client's brands (this is the coarse, whole-client grant; the individual-brand grant on
 * Manage Users' "Add Brand" picker, user_brand_access, is the fine-grained alternative — an
 * employee's actual visible-brands list unions both). */
export async function setClientAssignmentsForUser(userId: string, clientIds: string[]): Promise<void> {
  const sql = getDb();
  await sql`delete from account_manager_assignments where user_id = ${userId}`;
  for (const clientId of clientIds) {
    await sql`insert into account_manager_assignments (user_id, client_id) values (${userId}, ${clientId}) on conflict do nothing`;
  }
}
