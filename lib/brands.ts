import { getDb } from "./db";

export async function getBrandSlackChannelId(brandId: string): Promise<string | null> {
  const sql = getDb();
  const rows = await sql`select slack_channel_id from brands where id = ${brandId}`;
  return rows[0]?.slack_channel_id ?? null;
}

/** Reverse of getBrandSlackChannelId — which brand a Slack channel is mapped to, for commands
 * (like /seo-listing) that need to resolve "this channel" to a brand without a client: prefix. */
export async function getBrandBySlackChannelId(channelId: string): Promise<{ id: string; name: string } | null> {
  const sql = getDb();
  const rows = await sql`select id, name from brands where slack_channel_id = ${channelId}`;
  return rows[0] ? { id: rows[0].id, name: rows[0].name } : null;
}

export interface BrandClientInfo {
  brandName: string;
  clientId: string;
  clientName: string;
  /** null if this client hasn't actually signed up via Clerk yet (a pre-seeded/admin-created
   * client row) — Clerk org invitations can't be sent until it has one. */
  clerkOrgId: string | null;
}

export async function getBrandClientInfo(brandId: string): Promise<BrandClientInfo | null> {
  const sql = getDb();
  const rows = await sql`
    select b.name as brand_name, c.id as client_id, c.name as client_name, c.clerk_org_id
    from brands b join clients c on c.id = b.client_id
    where b.id = ${brandId}
  `;
  if (rows.length === 0) return null;
  return {
    brandName: rows[0].brand_name,
    clientId: rows[0].client_id,
    clientName: rows[0].client_name,
    clerkOrgId: rows[0].clerk_org_id,
  };
}

/** For the "add new brand" form's client picker — existing clients to add another brand under,
 * plus an option to create a brand-new client alongside the brand. */
export async function getAllClients(): Promise<{ id: string; name: string }[]> {
  const sql = getDb();
  const rows = await sql`select id, name from clients order by name`;
  return rows.map((r: any) => ({ id: r.id, name: r.name }));
}
