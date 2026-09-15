import { getDb } from "./db";

/** Shared by app/onboarding/page.tsx's sign-up server action and the Clerk webhook's
 * organization.created handler — both may end up provisioning the same org (the server action
 * creates it directly via Clerk's Backend SDK, but the webhook still fires afterward), so every
 * step here is idempotent on the client row.
 *
 * Deliberately does NOT create a brand. Signing up creates a user/client account only — a brand
 * (an actual Amazon/Walmart storefront under that client) is a separate concept an owner sets up
 * explicitly via /internal/brands/new, same as adding a second brand to an existing client. Until
 * that happens, the client's dashboard just shows "no brands yet" (app/dashboard/page.tsx already
 * handles this). This used to auto-create a same-named default brand at sign-up — removed since
 * that conflated "a person signed up" with "a real brand exists," producing junk brand rows. */
export async function provisionClientOrg({
  name,
  clerkOrgId,
  logoBlobKey,
}: {
  name: string;
  clerkOrgId: string;
  logoBlobKey?: string | null;
}): Promise<{ clientId: string } | null> {
  const sql = getDb();

  // Staff often pre-seed a client (and maybe a brand under it, migration 0009) before that client
  // ever signs up — link this new org to a pre-seeded, not-yet-linked client with the same name
  // instead of creating a duplicate.
  const preseeded = await sql`
    select id from clients where lower(name) = lower(${name}) and clerk_org_id is null limit 1
  `;
  if (preseeded.length > 0) {
    const clientId = preseeded[0].id;
    await sql`
      update clients set clerk_org_id = ${clerkOrgId}, logo_blob_key = coalesce(${logoBlobKey ?? null}, logo_blob_key)
      where id = ${clientId}
    `;
    return { clientId };
  }

  await sql`
    insert into clients (name, clerk_org_id, logo_blob_key)
    values (${name}, ${clerkOrgId}, ${logoBlobKey ?? null})
    on conflict (clerk_org_id) do nothing
  `;
  const row = await sql`select id from clients where clerk_org_id = ${clerkOrgId}`;
  if (row.length === 0) return null;
  return { clientId: row[0].id };
}
