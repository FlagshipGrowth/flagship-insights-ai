import { auth } from "@clerk/nextjs/server";
import { getDb } from "./db";

export type Role = "client_owner" | "client_teammate" | "account_manager" | "internal_admin";

export interface UserContext {
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
  const rows = await sql`select role, client_id, email from users where clerk_user_id = ${userId}`;
  if (rows.length === 0) return null;

  return { role: rows[0].role, clientId: rows[0].client_id, email: rows[0].email };
}

export function isInternalStaff(ctx: UserContext): boolean {
  return ctx.role === "account_manager" || ctx.role === "internal_admin";
}
