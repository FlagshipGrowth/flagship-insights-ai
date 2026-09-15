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

/** Unlike getBrandMetrics (which sums the whole period into one total per metric), this keeps
 * each day separate — what the Performance chart needs to plot a real line over time. */
export async function getBrandMetricsTimeSeries(brandId: string, period: Period) {
  const { from, to } = dateRangeFor(period);
  const sql = getDb();
  const rows = await sql`
    select date, channel, metric_key, value
    from metrics_daily
    where brand_id = ${brandId} and date >= ${from} and date <= ${to}
    order by date
  `;
  // The neon driver returns `numeric` columns as strings (to avoid float precision loss on
  // large values) but parses `date` into a native Date object — MetricsChart does real
  // arithmetic (.toFixed) on value and string ops (.localeCompare) on date, so normalize both
  // here rather than let every consumer remember to.
  return rows.map((r: any) => ({
    ...r,
    date: r.date instanceof Date ? r.date.toISOString() : String(r.date),
    value: Number(r.value),
  }));
}

/** userId also pulls in any brands explicitly granted via user_brand_access (see
 * lib/brand-access.ts) — multiple users, potentially across different clients, can be granted
 * visibility into the same brand this way, on top of whatever their own client owns. */
export async function getBrandsForClient(clientId: string, userId: string) {
  const sql = getDb();
  return sql`
    select distinct b.id, b.name, b.channels_enabled
    from brands b
    where b.client_id = ${clientId}
       or b.id in (select brand_id from user_brand_access where user_id = ${userId})
    order by b.name
  `;
}

export async function getLatestInsight(brandId: string) {
  const sql = getDb();
  const rows = await sql`
    select summary, created_at from insights
    where brand_id = ${brandId}
    order by created_at desc
    limit 1
  `;
  return rows[0] ?? null;
}

export async function getAllBrandsWithClients() {
  const sql = getDb();
  return sql`
    select b.id as brand_id, b.name as brand_name, c.id as client_id, c.name as client_name, b.channels_enabled,
           count(t.id) filter (where t.status <> 'done') as open_task_count
    from brands b
    join clients c on c.id = b.client_id
    left join tasks t on t.brand_id = b.id
    group by b.id, b.name, c.id, c.name, b.channels_enabled
    order by c.name, b.name
  `;
}

/** Same shape as getAllBrandsWithClients, but scoped to only the clients this account_manager
 * has been assigned — see account_manager_assignments (SPEC.md §2's "assigned clients" scope). */
export async function getAssignedBrandsWithClients(userId: string) {
  const sql = getDb();
  return sql`
    select b.id as brand_id, b.name as brand_name, c.id as client_id, c.name as client_name, b.channels_enabled,
           count(t.id) filter (where t.status <> 'done') as open_task_count
    from brands b
    join clients c on c.id = b.client_id
    join account_manager_assignments a on a.client_id = c.id
    left join tasks t on t.brand_id = b.id
    where a.user_id = ${userId}
    group by b.id, b.name, c.id, c.name, b.channels_enabled
    order by c.name, b.name
  `;
}
