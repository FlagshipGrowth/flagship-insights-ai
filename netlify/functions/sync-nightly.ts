import type { Config } from "@netlify/functions";
import { getDb, upsertMetrics } from "./lib/db";
import { CHANNEL_SYNCERS } from "./lib/channels/amazon";

// Keeps the internal (staff) view always current, regardless of whether any client has
// logged in. Runs once a day for every brand/channel connection on file.
export default async () => {
  const sql = getDb();
  const connections = await sql`select brand_id, channel, tokens from connections`;
  const today = new Date().toISOString().slice(0, 10);

  const results = await Promise.allSettled(
    connections.map(async (conn: any) => {
      const syncer = CHANNEL_SYNCERS[conn.channel];
      if (!syncer) return;
      const rows = await syncer(
        { brandId: conn.brand_id, channel: conn.channel, tokens: conn.tokens },
        today
      );
      await upsertMetrics(rows);
    })
  );

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.error(`sync-nightly: ${failures.length}/${connections.length} connections failed`, failures);
  }

  return new Response(
    JSON.stringify({ synced: connections.length - failures.length, failed: failures.length }),
    { status: 200 }
  );
};

export const config: Config = {
  schedule: "@daily",
};
