import { cache } from "react";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "./db";
import { parseEmailList } from "./env-lists";

export type Role = "client_owner" | "client_teammate" | "account_manager" | "internal_admin";

export type ApprovalStatus = "pending" | "approved";

export interface UserContext {
  id: string;
  role: Role;
  clientId: string | null;
  email: string;
  status: ApprovalStatus;
  /** Set only when the REAL signed-in user is an owner previewing someone else's account (see
   * lib/impersonation.ts) — everything else on this object describes the account being
   * previewed, not the real signed-in owner. */
  impersonating?: { realOwnerId: string; realOwnerEmail: string };
}

// Deliberately separate from INTERNAL_STAFF_EMAILS (which only bootstraps a role once, at
// sign-up) — this is checked live on every request, so Admin View access can never silently
// expand just because someone else ends up with the internal_admin role down the line.
const OWNER_EMAILS = parseEmailList(process.env.OWNER_EMAILS);

export function isOwner(ctx: UserContext): boolean {
  return OWNER_EMAILS.includes(ctx.email.toLowerCase());
}

const IMPERSONATION_COOKIE = "fg_impersonate_user_id";

async function loadUserRow(sql: ReturnType<typeof getDb>, where: { clerkUserId?: string; id?: string }) {
  const rows = where.clerkUserId
    ? await sql`select id, role, client_id, email, status from users where clerk_user_id = ${where.clerkUserId}`
    : await sql`select id, role, client_id, email, status from users where id = ${where.id}`;
  if (rows.length === 0) return null;
  return { id: rows[0].id, role: rows[0].role, clientId: rows[0].client_id, email: rows[0].email, status: rows[0].status } as Omit<
    UserContext,
    "impersonating"
  >;
}

/** Looks up the signed-in Clerk user in our own `users` table — that table (kept in sync by
 * app/api/webhooks/clerk/route.ts) is the source of truth for role, not Clerk's own claims.
 * Wrapped in React's cache() since this is called from both a page and the impersonation banner
 * on the same request. */
export const getUserContext = cache(async (): Promise<UserContext | null> => {
  const { userId } = await auth();
  if (!userId) return null;

  const sql = getDb();
  const realCtx = await loadUserRow(sql, { clerkUserId: userId });
  if (!realCtx) return null;

  // Impersonation only ever applies on top of a genuinely real owner session — the cookie
  // selects WHO to preview, never identity itself, and a stale/invalid value just falls back to
  // the real owner's own context rather than erroring.
  if (!isOwner(realCtx)) return realCtx;

  const targetId = (await cookies()).get(IMPERSONATION_COOKIE)?.value;
  if (!targetId || targetId === realCtx.id) return realCtx;

  const target = await loadUserRow(sql, { id: targetId });
  if (!target) return realCtx;

  return { ...target, impersonating: { realOwnerId: realCtx.id, realOwnerEmail: realCtx.email } };
});

export function isInternalStaff(ctx: UserContext): boolean {
  return ctx.role === "account_manager" || ctx.role === "internal_admin";
}

/** Everyone's email is firstname@flagshipgrowth.com, and that's exactly what's already sitting
 * in `tasks.assignee` from the roster (e.g. "Shahrukh", "Gabe") — so "my tasks" is just this
 * name compared case-insensitively against `assignee`, live at query time. No signup-time link
 * to maintain: whoever's logged in always sees whatever currently matches their own name. */
export function deriveNameFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? "";
  return localPart.charAt(0).toUpperCase() + localPart.slice(1).toLowerCase();
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
