/** Comma-separated env var -> lowercased, trimmed email list. Shared by the Clerk webhook
 * (staff-role bootstrap) and lib/user-context.ts (the live OWNER_EMAILS check). */
export function parseEmailList(envVar: string | undefined): string[] {
  return (envVar ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
