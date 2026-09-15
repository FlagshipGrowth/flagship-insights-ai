import { getDb } from "./db";
import type { Period } from "./metrics";

// Same date-range convention as lib/metrics.ts's dateRangeFor, duplicated rather than imported
// since that one is brand-scoped and this isn't — not worth a shared abstraction for four lines.
function dateRangeFor(period: Period): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  let from: string;
  switch (period) {
    case "daily":
      from = to;
      break;
    case "mtd":
      from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      break;
    case "ytd":
      from = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
      break;
    case "lifetime":
      from = "1970-01-01";
      break;
  }
  return { from, to };
}

export interface AgencyMetricPoint {
  date: string;
  channel: string;
  metric_key: string;
  value: number;
}

/** Mirrors getBrandMetricsTimeSeries's shape exactly — MetricsChart consumes either with no
 * changes needed. */
export async function getAgencyMarketingMetricsSeries(period: Period): Promise<AgencyMetricPoint[]> {
  const { from, to } = dateRangeFor(period);
  const sql = getDb();
  const rows = await sql`
    select date, channel, metric_key, value
    from agency_marketing_metrics
    where date >= ${from} and date <= ${to}
    order by date
  `;
  return rows.map((r: any) => ({
    channel: r.channel,
    metric_key: r.metric_key,
    date: r.date instanceof Date ? r.date.toISOString() : String(r.date),
    value: Number(r.value),
  }));
}

export async function getAgencyMarketingSummary(period: Period) {
  const { from, to } = dateRangeFor(period);
  const sql = getDb();
  return sql`
    select channel, metric_key, sum(value) as total
    from agency_marketing_metrics
    where date >= ${from} and date <= ${to}
    group by channel, metric_key
    order by channel, metric_key
  `;
}

export async function getLastSyncedAt(): Promise<string | null> {
  const sql = getDb();
  const rows = await sql`select max(created_at) as last from agency_marketing_metrics`;
  return rows[0]?.last ? new Date(rows[0].last).toISOString() : null;
}

export interface AgencyMetricInput {
  channel: string;
  date: string;
  metric_key: string;
  value: number;
}

/** Upsert used by both the /api/marketing/sync route (daily cron pull) and the one-off seed of
 * historical data — keyed on (channel, date, metric_key) so re-running a pull for a day already
 * synced just overwrites it rather than duplicating. */
export async function upsertAgencyMarketingMetrics(rows: AgencyMetricInput[]): Promise<void> {
  if (rows.length === 0) return;
  const sql = getDb();
  for (const r of rows) {
    await sql`
      insert into agency_marketing_metrics (channel, date, metric_key, value)
      values (${r.channel}, ${r.date}, ${r.metric_key}, ${r.value})
      on conflict (channel, date, metric_key) do update set value = excluded.value
    `;
  }
}
