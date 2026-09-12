import { getDb } from "./db";

/** For the "add new brand" form's account-manager picker. */
export async function getAccountManagerUsers(): Promise<{ id: string; email: string }[]> {
  const sql = getDb();
  const rows = await sql`select id, email from users where role = 'account_manager' order by email`;
  return rows.map((r: any) => ({ id: r.id, email: r.email }));
}

export interface BrandAccessUser {
  id: string;
  email: string;
  role: string;
  /** false if this row was pre-provisioned (an invite sent/pending, or an admin-added row) but
   * the person hasn't actually signed in via Clerk yet. */
  hasClerkAccount: boolean;
}

/** Everyone with access to a brand: its client's own users (owner/teammate) plus any account
 * managers assigned to that client via account_manager_assignments — the same two sources
 * canStaffAccessBrand() and getAssignedBrandsWithClients() already check, just listed instead of
 * gated. */
export async function getUsersWithBrandAccess(clientId: string): Promise<BrandAccessUser[]> {
  const sql = getDb();
  const rows = await sql`
    (select id, email, role, clerk_user_id from users where client_id = ${clientId})
    union
    (select u.id, u.email, u.role, u.clerk_user_id
     from users u join account_manager_assignments a on a.user_id = u.id
     where a.client_id = ${clientId})
    order by role, email
  `;
  return rows.map((r: any) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    hasClerkAccount: r.clerk_user_id !== null,
  }));
}
