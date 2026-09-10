import { getDb, upsertMetrics } from "./lib/db";
import { CHANNEL_SYNCERS } from "./lib/channels/amazon";

// Keeps client-facing dashboards fast without paying for a nightly sync no one's about to
// look at: the portal's login handler calls this (fire-and-forget) rather than the client
// waiting on it — it's a Netlify background function, so it can run past the 30s scheduled-
// function cap. There's no auth layer yet (Phase 3), so this takes brandId directly rather
// than resolving it from a session.
export default async (req: Request) => {
  const { brandId } = await req.json();
  if (!brandId) {
    return new Response("brandId is required", { status: 400 });
  }

  const sql = getDb();
  const connections = await sql`select brand_id, channel, tokens from connections where brand_id = ${brandId}`;
  const today = new Date().toISOString().slice(0, 10);

  for (const conn of connections as any[]) {
    const syncer = CHANNEL_SYNCERS[conn.channel];
    if (!syncer) continue;
    const rows = await syncer(
      { brandId: conn.brand_id, channel: conn.channel, tokens: conn.tokens },
      today
    );
    await upsertMetrics(rows);
  }
};
