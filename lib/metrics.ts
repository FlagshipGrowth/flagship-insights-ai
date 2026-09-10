import { getDb } from "./db";

export type Period = "daily" | "mtd" | "ytd" | "lifetime";
export const PERIODS: Period[] = ["daily", "mtd", "ytd", "lifetime"];

// Daily/MTD/YTD/Lifetime are all just date-range filters on metrics_daily (SPEC.md §5) —
// no per-view special casing.
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

export async function getBrandMetrics(brandId: string, period: Period) {
  const { from, to } = dateRangeFor(period);
  const sql = getDb();
  return sql`
    select channel, metric_key, sum(value) as total
    from metrics_daily
    where brand_id = ${brandId} and date >= ${from} and date <= ${to}
    group by channel, metric_key
    order by channel, metric_key
  `;
}

export async function getBrandsForClient(clientId: string) {
  const sql = getDb();
  return sql`select id, name, channels_enabled from brands where client_id = ${clientId} order by name`;
}

export async function getAllBrandsWithClients() {
  const sql = getDb();
  return sql`
    select b.id as brand_id, b.name as brand_name, c.id as client_id, c.name as client_name, b.channels_enabled
    from brands b join clients c on c.id = b.client_id
    order by c.name, b.name
  `;
}
