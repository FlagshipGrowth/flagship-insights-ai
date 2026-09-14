"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserContext, isOwner } from "./user-context";
import { getDb } from "./db";

const IMPERSONATION_COOKIE = "fg_impersonate_user_id";

/** Owner-only — starts previewing another real account. Only ever selects WHO to preview; the
 * real Clerk session/identity is untouched (see lib/user-context.ts's getUserContext). */
export async function startImpersonation(formData: FormData) {
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx) || ctx.impersonating) return;

  const targetUserId = formData.get("userId") as string;
  if (!targetUserId) return;

  const sql = getDb();
  const target = await sql`select role from users where id = ${targetUserId}`;
  if (target.length === 0) return;

  (await cookies()).set(IMPERSONATION_COOKIE, targetUserId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours — matches a normal workday, not meant to be a standing session
  });

  redirect(target[0].role === "client_owner" || target[0].role === "client_teammate" ? "/dashboard" : "/internal");
}

export async function exitImpersonation() {
  (await cookies()).delete(IMPERSONATION_COOKIE);
  revalidatePath("/", "layout");
}
