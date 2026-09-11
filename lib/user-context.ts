import { auth } from "@clerk/nextjs/server";
import { getDb } from "./db";

export type Role = "client_owner" | "client_teammate" | "account_manager" | "internal_admin";

export interface UserContext {
  id: string;
  role: Role;
  clientId: string | null;
  email: string;
}

/** Looks up the signed-in Clerk user in our own `users` table — that table (kept in sync by
 * app/api/webhooks/clerk/route.ts) is the source of truth for role, not Clerk's own claims. */
export async function getUserContext(): Promise<UserContext | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const sql = getDb();
  const rows = await sql`select id, role, client_id, email from users where clerk_user_id = ${userId}`;
  if (rows.length === 0) return null;

  return { id: rows[0].id, role: rows[0].role, clientId: rows[0].client_id, email: rows[0].email };
}

export function isInternalStaff(ctx: UserContext): boolean {
  return ctx.role === "account_manager" || ctx.role === "internal_admin";
}

/** internal_admin can access any brand; account_manager only brands under their assigned
 * clients (account_manager_assignments) — same scoping as the /internal list view. */
export async function canStaffAccessBrand(ctx: UserContext, brandId: string): Promise<boolean> {
  if (ctx.role === "internal_admin") return true;
  if (ctx.role !== "account_manager") return false;

  const sql = getDb();
  const rows = await sql`
    select 1 from brands b
    join account_manager_assignments a on a.client_id = b.client_id
    where b.id = ${brandId} and a.user_id = ${ctx.id}
  `;
  return rows.length > 0;
}
