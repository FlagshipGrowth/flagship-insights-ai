import { neon } from "@neondatabase/serverless";
import { getConnectionString } from "@netlify/database";

// getConnectionString() reads Netlify DB's own env var (NETLIFY_DB_URL), injected
// automatically once the Netlify DB instance is provisioned — not a generic DATABASE_URL.
export function getDb() {
  return neon(getConnectionString());
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
