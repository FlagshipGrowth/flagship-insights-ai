import { neon } from "@neondatabase/serverless";

// DATABASE_URL is set via `netlify env:set` once the Netlify DB (Neon) instance exists —
// see docs in the repo README for the one-time setup. Never hardcode it here.
export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set — provision the Netlify DB instance first.");
  }
  return neon(url);
}

export interface MetricRow {
  brandId: string;
  channel: string;
  date: string; // YYYY-MM-DD
  metricKey: string;
  value: number;
}

export async function upsertMetrics(rows: MetricRow[]): Promise<void> {
  const sql = getDb();
  for (const row of rows) {
    await sql`
      insert into metrics_daily (brand_id, channel, date, metric_key, value)
      values (${row.brandId}, ${row.channel}, ${row.date}, ${row.metricKey}, ${row.value})
      on conflict (brand_id, channel, date, metric_key)
      do update set value = excluded.value
    `;
  }
}
