import type { Config } from "@netlify/functions";
import { upsertMetrics } from "./lib/db";
import { getAllConnections } from "./lib/connections";
import { CHANNEL_SYNCERS } from "./lib/channels/amazon";

// Keeps the internal (staff) view always current, regardless of whether any client has
// logged in. Runs once a day for every brand/channel connection on file.
export default async () => {
  const connections = await getAllConnections();
  const today = new Date().toISOString().slice(0, 10);

  const results = await Promise.allSettled(
    connections.map(async (conn) => {
      const syncer = CHANNEL_SYNCERS[conn.channel];
      if (!syncer) return;
      const rows = await syncer(conn, today);
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
