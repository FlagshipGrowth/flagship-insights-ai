import { getDb } from "./db";

export interface Employee {
  id: string;
  email: string;
  hasClerkAccount: boolean;
  assignedClientNames: string[];
}

/** For /internal/employees — every "Employee" (role account_manager) account, owner-invited or
 * legacy env-bootstrapped, with their current assigned-clients (account_manager_assignments) for
 * context. Mirrors the hasClerkAccount convention already established in lib/staff.ts. */
export async function getEmployees(): Promise<Employee[]> {
  const sql = getDb();
  const rows = await sql`
    select u.id, u.email, u.clerk_user_id, coalesce(array_agg(c.name) filter (where c.name is not null), '{}') as client_names
    from users u
    left join account_manager_assignments a on a.user_id = u.id
    left join clients c on c.id = a.client_id
    where u.role = 'account_manager'
    group by u.id, u.email, u.clerk_user_id
    order by u.email
  `;
  return rows.map((r: any) => ({
    id: r.id,
    email: r.email,
    hasClerkAccount: r.clerk_user_id !== null,
    assignedClientNames: r.client_names as string[],
  }));
}
