import { getDb } from "./db";

/** Shared by app/onboarding/page.tsx's sign-up server action and the Clerk webhook's
 * organization.created handler — both may end up provisioning the same org (the server action
 * creates it directly via Clerk's Backend SDK, but the webhook still fires afterward), so every
 * step here is idempotent on both the client row and the one-default-brand row. */
export async function provisionClientOrg({
  name,
  clerkOrgId,
  logoBlobKey,
}: {
  name: string;
  clerkOrgId: string;
  logoBlobKey?: string | null;
}): Promise<{ clientId: string; brandId: string } | null> {
  const sql = getDb();

  // Staff often pre-seed a client's brand(s) (migration 0009) before that client ever signs up —
  // link this new org to a pre-seeded, not-yet-linked client with the same name instead of
  // creating a duplicate.
  const preseeded = await sql`
    select id from clients where lower(name) = lower(${name}) and clerk_org_id is null limit 1
  `;
  let clientId: string;
  if (preseeded.length > 0) {
    clientId = preseeded[0].id;
    await sql`
      update clients set clerk_org_id = ${clerkOrgId}, logo_blob_key = coalesce(${logoBlobKey ?? null}, logo_blob_key)
      where id = ${clientId}
    `;
  } else {
    await sql`
      insert into clients (name, clerk_org_id, logo_blob_key)
      values (${name}, ${clerkOrgId}, ${logoBlobKey ?? null})
      on conflict (clerk_org_id) do nothing
    `;
    const row = await sql`select id from clients where clerk_org_id = ${clerkOrgId}`;
    if (row.length === 0) return null;
    clientId = row[0].id;
  }

  // One default brand per new client org — multi-brand-per-client management is a fast-follow
  // (SPEC.md §4's `brands` table already supports it). Idempotent: don't create a second one if
  // this is called twice for the same org (server action + webhook both firing).
  const existingBrand = await sql`select id from brands where client_id = ${clientId} limit 1`;
  if (existingBrand.length > 0) return { clientId, brandId: existingBrand[0].id };

  const newBrand = await sql`
    insert into brands (client_id, name, channels_enabled) values (${clientId}, ${name}, '{}') returning id
  `;
  return { clientId, brandId: newBrand[0].id };
}
