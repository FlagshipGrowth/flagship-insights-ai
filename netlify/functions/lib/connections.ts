import { getDb } from "./db";
import { encryptToken, decryptToken } from "./crypto";

export interface DecryptedConnection {
  brandId: string;
  channel: string;
  tokens: Record<string, unknown>;
}

export async function getConnection(brandId: string, channel: string): Promise<DecryptedConnection | null> {
  const sql = getDb();
  const rows = await sql`
    select brand_id, channel, tokens from connections
    where brand_id = ${brandId} and channel = ${channel}
  `;
  if (rows.length === 0) return null;
  return decryptRow(rows[0]);
}

export async function getConnectionsForBrand(brandId: string): Promise<DecryptedConnection[]> {
  const sql = getDb();
  const rows = await sql`select brand_id, channel, tokens from connections where brand_id = ${brandId}`;
  return rows.map(decryptRow);
}

export async function getAllConnections(): Promise<DecryptedConnection[]> {
  const sql = getDb();
  const rows = await sql`select brand_id, channel, tokens from connections`;
  return rows.map(decryptRow);
}

export async function upsertConnection(
  brandId: string,
  channel: string,
  tokens: Record<string, unknown>
): Promise<void> {
  const sql = getDb();
  const encrypted = encryptToken(JSON.stringify(tokens));
  await sql`
    insert into connections (brand_id, channel, tokens, last_synced_at)
    values (${brandId}, ${channel}, ${encrypted}, now())
    on conflict (brand_id, channel)
    do update set tokens = excluded.tokens, last_synced_at = now()
  `;
}

function decryptRow(row: any): DecryptedConnection {
  return {
    brandId: row.brand_id,
    channel: row.channel,
    tokens: JSON.parse(decryptToken(Buffer.from(row.tokens))),
  };
}
