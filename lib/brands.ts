import { getDb } from "./db";

export async function getBrandSlackChannelId(brandId: string): Promise<string | null> {
  const sql = getDb();
  const rows = await sql`select slack_channel_id from brands where id = ${brandId}`;
  return rows[0]?.slack_channel_id ?? null;
}
