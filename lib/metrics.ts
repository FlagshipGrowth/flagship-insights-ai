import { getDb } from "./db";

export type Period = "weekly" | "mtd" | "ytd" | "lifetime";
export const PERIODS: Period[] = ["weekly", "mtd", "ytd", "lifetime"];

export interface BrandMetricInput {
  brandId: string;
  channel: string;
  date: string;
  metric_key: string;
  value: number;
}

/** Brand-scoped counterpart to lib/marketing.ts's upsertAgencyMarketingMetrics — same
 * upsert-on-conflict shape, targeting metrics_daily (its own primary key is already
 * (brand_id, channel, date, metric_key), so this is the natural conflict target). Used by
 * /api/tiktok-shop/sync (and any future app-tree channel sync route) — the existing Amazon
 * nightly sync writes via netlify/functions/lib/db.ts's upsertMetrics instead, a separate
 * function in the Netlify Functions bundle tree, not this one. */
export async function upsertBrandMetrics(rows: BrandMetricInput[]): Promise<void> {
  if (rows.length === 0) return;
  const sql = getDb();
  for (const r of rows) {
    await sql`
      insert into metrics_daily (brand_id, channel, date, metric_key, value)
      values (${r.brandId}, ${r.channel}, ${r.date}, ${r.metric_key}, ${r.value})
      on conflict (brand_id, channel, date, metric_key) do update set value = excluded.value
    `;
  }
}

// Weekly/MTD/YTD/Lifetime are all just date-range filters on metrics_daily (SPEC.md §5) —
// no per-view special casing on the totals side (getBrandMetrics). getBrandMetricsTimeSeries
// additionally rolls Weekly up to one point per week (last 10 weeks) and YTD/Lifetime up to one
// point per month — see there.
function dateRangeFor(period: Period): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  let from: string;
  switch (period) {
    case "weekly": {
      // Last 10 ISO weeks (Monday-start), including the current, possibly-partial week — so the
      // range starts exactly 9 full weeks before this week's Monday.
      const day = now.getDay(); // 0=Sun..6=Sat, local time
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
      const tenWeeksBack = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - 9 * 7);
      from = tenWeeksBack.toISOString().slice(0, 10);
      break;
    }
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

export async function getBrandMetrics(brandId: string, period: Period, channel?: string) {
  const { from, to } = dateRangeFor(period);
  const sql = getDb();
  return sql`
    select channel, metric_key, sum(value) as total
    from metrics_daily
    where brand_id = ${brandId} and date >= ${from} and date <= ${to}
      and (${channel ?? null}::text is null or channel = ${channel ?? null})
    group by channel, metric_key
    order by channel, metric_key
  `;
}

/** Unlike getBrandMetrics (which sums the whole period into one total per metric), this keeps
 * the series broken out over time — what the Performance chart needs to plot as a bar per
 * period. Granularity varies by period (SPEC.md §5): MTD plots one bar per day; Weekly rolls up
 * to one bar per week (its date range is already scoped to the last 10 weeks — see
 * dateRangeFor); YTD and Lifetime both roll up to one bar per month — a full year (or a lifetime)
 * of daily bars is unreadable. MetricsChart's x-axis is band-index-based, so it renders whatever
 * granularity of point it's given the same way (see components/MetricsChart.tsx). Pass `channel`
 * to scope to one marketplace/channel (e.g. Hapad's "amazon-us" vs "amazon-canada", which share
 * one brand_id) — omit for all. */
export async function getBrandMetricsTimeSeries(brandId: string, period: Period, channel?: string) {
  const { from, to } = dateRangeFor(period);
  const sql = getDb();
  const rows =
    period === "ytd" || period === "lifetime"
      ? await sql`
          select date_trunc('month', date)::date as date, channel, metric_key, sum(value) as value
          from metrics_daily
          where brand_id = ${brandId} and date >= ${from} and date <= ${to}
            and (${channel ?? null}::text is null or channel = ${channel ?? null})
          group by date_trunc('month', date), channel, metric_key
          order by date
        `
      : period === "weekly"
        ? await sql`
            select date_trunc('week', date)::date as date, channel, metric_key, sum(value) as value
            from metrics_daily
            where brand_id = ${brandId} and date >= ${from} and date <= ${to}
              and (${channel ?? null}::text is null or channel = ${channel ?? null})
            group by date_trunc('week', date), channel, metric_key
            order by date
          `
        : await sql`
            select date, channel, metric_key, value
            from metrics_daily
            where brand_id = ${brandId} and date >= ${from} and date <= ${to}
              and (${channel ?? null}::text is null or channel = ${channel ?? null})
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

export type TileKey =
  | "revenue"
  | "units"
  | "organic_sales"
  | "ppc_spend"
  | "ppc_sales"
  | "refund_rate"
  | "acos"
  | "tacos"
  | "roas"
  | "cpc";

// Fixed display order for the Performance tile grid (components/PerformanceTiles.tsx).
export const TILE_ORDER: TileKey[] = [
  "revenue",
  "units",
  "organic_sales",
  "ppc_spend",
  "ppc_sales",
  "refund_rate",
  "acos",
  "tacos",
  "roas",
  "cpc",
];

export interface PerformanceTile {
  key: TileKey;
  value: number;
  wowChangePct: number | null;
  sparkline: { date: string; value: number }[];
}

// The raw, summable components every tile is derived from. Ratio metrics (refund_rate, acos,
// tacos, roas, cpc) must NEVER be summed directly across days — getBrandMetrics's flat
// `sum(value)` is correct for revenue/units/ppc_spend/ppc_sales but silently wrong for a stored
// ratio snapshot at any multi-day rollup (7 days of ~12% ACoS summed is not 84% ACoS). Instead
// every ratio is (re)computed here from sums of its raw components over the window in question —
// see deriveTileValue. ppc_clicks/refund_amount aren't part of the older metric_key vocabulary
// (see METRIC_LABELS in components/MetricsChart.tsx) — they're written going forward by
// sellerise-daily-sync specifically to make this derivation possible.
const RAW_TILE_KEYS = ["revenue", "units", "ppc_spend", "ppc_sales", "ppc_clicks", "refund_amount"] as const;
type RawKey = (typeof RAW_TILE_KEYS)[number];
type RawSums = Record<RawKey, number>;

function emptySums(): RawSums {
  return { revenue: 0, units: 0, ppc_spend: 0, ppc_sales: 0, ppc_clicks: 0, refund_amount: 0 };
}

function addToSums(sums: RawSums, metricKey: string, value: number) {
  if ((RAW_TILE_KEYS as readonly string[]).includes(metricKey)) {
    sums[metricKey as RawKey] += value;
  }
}

function deriveTileValue(key: TileKey, s: RawSums): number {
  switch (key) {
    case "revenue":
      return s.revenue;
    case "units":
      return s.units;
    case "organic_sales":
      return s.revenue - s.ppc_sales;
    case "ppc_spend":
      return s.ppc_spend;
    case "ppc_sales":
      return s.ppc_sales;
    case "refund_rate":
      return s.revenue > 0 ? (s.refund_amount / s.revenue) * 100 : 0;
    case "acos":
      return s.ppc_sales > 0 ? (s.ppc_spend / s.ppc_sales) * 100 : 0;
    case "tacos":
      return s.revenue > 0 ? (s.ppc_spend / s.revenue) * 100 : 0;
    case "roas":
      return s.ppc_spend > 0 ? s.ppc_sales / s.ppc_spend : 0;
    case "cpc":
      return s.ppc_clicks > 0 ? s.ppc_spend / s.ppc_clicks : 0;
  }
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// The tile's headline value isn't always dateRangeFor(period) as-is — "weekly"'s range is 10
// weeks (sized for the sparkline), but the single value on the tile is just the current week,
// matching what the WoW badge compares against.
function valueWindowFor(period: Period): { from: string; to: string } {
  if (period === "weekly") {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    return { from: isoDate(from), to: isoDate(now) };
  }
  return dateRangeFor(period);
}

// Period-over-period comparison window for the WoW badge, per period: weekly = trailing 7 days
// vs the 7 before that; mtd = this month vs the same day-of-month range last month; ytd = this
// year-to-date vs the same YTD range last year; lifetime = no comparison (null).
function comparisonWindowFor(period: Period): { from: string; to: string } | null {
  const now = new Date();
  switch (period) {
    case "weekly": {
      const to = new Date(now);
      to.setDate(to.getDate() - 7);
      const from = new Date(now);
      from.setDate(from.getDate() - 13);
      return { from: isoDate(from), to: isoDate(to) };
    }
    case "mtd": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      return { from: isoDate(from), to: isoDate(to) };
    }
    case "ytd": {
      const from = new Date(now.getFullYear() - 1, 0, 1);
      const to = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      return { from: isoDate(from), to: isoDate(to) };
    }
    case "lifetime":
      return null;
  }
}

/** The Performance tile grid's data source (components/PerformanceTiles.tsx) — 10 metrics (see
 * TILE_ORDER), each with a current value, a period-over-period WoW change %, and a sparkline.
 * See RAW_TILE_KEYS/deriveTileValue above for why ratio metrics are computed here rather than
 * read as stored snapshots. */
export async function getBrandPerformanceTiles(
  brandId: string,
  period: Period,
  channel?: string
): Promise<PerformanceTile[]> {
  const sql = getDb();
  const valueWindow = valueWindowFor(period);
  const compareWindow = comparisonWindowFor(period);
  const sparkWindow = dateRangeFor(period);

  const bounds = [valueWindow.from, valueWindow.to, sparkWindow.from, sparkWindow.to, compareWindow?.from, compareWindow?.to].filter(
    (d): d is string => !!d
  );
  const earliest = bounds.slice().sort()[0];
  const latest = bounds.slice().sort().slice(-1)[0];

  const rows = await sql`
    select date, metric_key, sum(value) as value
    from metrics_daily
    where brand_id = ${brandId} and channel = 'amazon' and date >= ${earliest} and date <= ${latest}
      and (${channel ?? null}::text is null or channel = ${channel ?? null})
    group by date, metric_key
    order by date
  `;
  const normalized = rows.map((r: any) => ({
    date: r.date instanceof Date ? isoDate(r.date) : String(r.date).slice(0, 10),
    metric_key: r.metric_key as string,
    value: Number(r.value),
  }));

  const valueSums = emptySums();
  const compareSums = emptySums();
  for (const r of normalized) {
    if (r.date >= valueWindow.from && r.date <= valueWindow.to) addToSums(valueSums, r.metric_key, r.value);
    if (compareWindow && r.date >= compareWindow.from && r.date <= compareWindow.to) addToSums(compareSums, r.metric_key, r.value);
  }

  // Sparkline buckets: same granularity convention as getBrandMetricsTimeSeries (per-ISO-week
  // for weekly's 10-week range, per-day for mtd, per-month for ytd/lifetime) — but each bucket's
  // ratio metrics are derived from that bucket's own summed raw components, not the overall
  // period sum, so the sparkline doesn't reintroduce the summing bug at bucket boundaries.
  const bucketKeyFor = (date: string): string => {
    if (period === "ytd" || period === "lifetime") return date.slice(0, 7) + "-01";
    if (period === "weekly") {
      const d = new Date(date + "T00:00:00Z");
      const day = d.getUTCDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      d.setUTCDate(d.getUTCDate() + diffToMonday);
      return isoDate(d);
    }
    return date;
  };
  const sparkBuckets = new Map<string, RawSums>();
  for (const r of normalized) {
    if (r.date < sparkWindow.from || r.date > sparkWindow.to) continue;
    const key = bucketKeyFor(r.date);
    if (!sparkBuckets.has(key)) sparkBuckets.set(key, emptySums());
    addToSums(sparkBuckets.get(key)!, r.metric_key, r.value);
  }
  const sortedBucketDates = Array.from(sparkBuckets.keys()).sort();

  return TILE_ORDER.map((key) => {
    const value = deriveTileValue(key, valueSums);
    const previous = compareWindow ? deriveTileValue(key, compareSums) : null;
    const wowChangePct = previous === null || previous === 0 ? null : ((value - previous) / Math.abs(previous)) * 100;
    const sparkline = sortedBucketDates.map((d) => ({ date: d, value: deriveTileValue(key, sparkBuckets.get(d)!) }));
    return { key, value, wowChangePct, sparkline };
  });
}

/** Most brands keep one marketplace per brand row (e.g. "Dormeo US" / "Dormeo CA" are two
 * separate brands sharing a client) — but a few (Hapad) keep one brand row with marketplace
 * baked into the channel name instead ("amazon-us" / "amazon-canada", see
 * netlify/functions/lib/reports/sync.ts's channelForLabel). This surfaces that second case: any
 * channel on this brand beyond the plain "amazon"/"tiktok_shop"/etc. default, i.e. one matching
 * "amazon-<suffix>". Returns [] for the common single-marketplace-per-brand case. */
export async function getBrandMarketplaceChannels(brandId: string): Promise<{ channel: string; label: string }[]> {
  const sql = getDb();
  const rows = await sql`
    select distinct channel from metrics_daily
    where brand_id = ${brandId} and channel like 'amazon-%'
    order by channel
  `;
  return rows.map((r: any) => ({
    channel: r.channel as string,
    label: (r.channel as string)
      .slice("amazon-".length)
      .split("-")
      // A 2-letter word is a country code (us, ca, mx, uk) — keep it fully uppercase rather
      // than title-casing it into "Us"/"Ca".
      .map((w) => (w.length === 2 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(" "),
  }));
}

/** userId also pulls in any brands explicitly granted via user_brand_access (see
 * lib/brand-access.ts) — multiple users, potentially across different clients, can be granted
 * visibility into the same brand this way, on top of whatever their own client owns. */
export async function getBrandsForClient(clientId: string, userId: string) {
  const sql = getDb();
  return sql`
    select distinct b.id, b.name, b.channels_enabled, (b.sellerise_account_name is not null) as has_sellerise
    from brands b
    where b.client_id = ${clientId}
       or b.id in (select brand_id from user_brand_access where user_id = ${userId})
    order by b.name
  `;
}

/** Whether Sellerise is the connected, authoritative Amazon data source for this brand — see
 * app/api/sellerise/sync/route.ts. Brands without it get "No Amazon connection found" instead of
 * a chart, rather than falling back to the older weekly-report scrape (see
 * netlify/functions/lib/reports/sync.ts's syncAllWeeklyReports, which still writes metrics_daily
 * for these brands, but is no longer treated as a real Amazon connection in the UI). */
export async function brandHasSellerise(brandId: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`select sellerise_account_name is not null as has_sellerise from brands where id = ${brandId}`;
  return rows[0]?.has_sellerise ?? false;
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

/** Same shape as getAllBrandsWithClients, but scoped to only the brands this account_manager can
 * see — either via a whole-client assignment (account_manager_assignments, SPEC.md §2's "assigned
 * clients" scope) or a direct per-brand grant (user_brand_access, same mechanism clients use). */
export async function getAssignedBrandsWithClients(userId: string) {
  const sql = getDb();
  return sql`
    select b.id as brand_id, b.name as brand_name, c.id as client_id, c.name as client_name, b.channels_enabled,
           count(t.id) filter (where t.status <> 'done') as open_task_count
    from brands b
    join clients c on c.id = b.client_id
    left join tasks t on t.brand_id = b.id
    where c.id in (select client_id from account_manager_assignments where user_id = ${userId})
       or b.id in (select brand_id from user_brand_access where user_id = ${userId})
    group by b.id, b.name, c.id, c.name, b.channels_enabled
    order by c.name, b.name
  `;
}
