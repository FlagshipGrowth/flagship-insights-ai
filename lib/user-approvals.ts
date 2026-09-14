import { getDb } from "./db";

export interface PendingUser {
  id: string;
  email: string;
  role: string;
  clientName: string | null;
  createdAt: string;
}

/** New client sign-ups awaiting admin approval — see migration 0025 and the
 * organizationMembership.created/updated handler in app/api/webhooks/clerk/route.ts, the only
 * path that inserts a 'pending' row. */
export async function getPendingUsers(): Promise<PendingUser[]> {
  const sql = getDb();
  const rows = await sql`
    select u.id, u.email, u.role, c.name as client_name, u.created_at
    from users u
    left join clients c on c.id = u.client_id
    where u.status = 'pending'
    order by u.created_at asc
  `;
  return rows.map((r: any) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    clientName: r.client_name,
    createdAt: r.created_at,
  }));
}

export async function getPendingUsersCount(): Promise<number> {
  const sql = getDb();
  const rows = await sql`select count(*) as count from users where status = 'pending'`;
  return Number(rows[0]?.count ?? 0);
}

export async function approveUser(userId: string): Promise<void> {
  const sql = getDb();
  await sql`update users set status = 'approved' where id = ${userId} and status = 'pending'`;
}
