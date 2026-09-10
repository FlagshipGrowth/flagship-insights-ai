import { getDb } from "./db";

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Current ~30-day period vs the ~30 days immediately before it, summed per metric_key —
 * the same shape phase0's sample data used, now built from real metrics_daily rows. */
export async function getPeriodComparison(brandId: string, channel: string) {
  const sql = getDb();
  const today = new Date();
  const currentTo = toDateString(today);
  const currentFrom = toDateString(new Date(today.getTime() - 29 * 86400000));
  const previousTo = toDateString(new Date(today.getTime() - 30 * 86400000));
  const previousFrom = toDateString(new Date(today.getTime() - 59 * 86400000));

  const current = await sql`
    select metric_key, sum(value) as total from metrics_daily
    where brand_id = ${brandId} and channel = ${channel} and date between ${currentFrom} and ${currentTo}
    group by metric_key
  `;
  const previous = await sql`
    select metric_key, sum(value) as total from metrics_daily
    where brand_id = ${brandId} and channel = ${channel} and date between ${previousFrom} and ${previousTo}
    group by metric_key
  `;

  return {
    current_period: { label: `${currentFrom} to ${currentTo}`, ...rowsToObject(current) },
    previous_period: { label: `${previousFrom} to ${previousTo}`, ...rowsToObject(previous) },
  };
}

function rowsToObject(rows: { metric_key: string; total: string }[] | any[]): Record<string, number> {
  const obj: Record<string, number> = {};
  for (const row of rows) obj[row.metric_key] = Number(row.total);
  return obj;
}
