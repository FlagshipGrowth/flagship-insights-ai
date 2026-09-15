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

export type RecommendationCategory = "performance" | "creative";
export type RecommendationStatus = "open" | "actioned" | "dismissed";

export interface MarketingRecommendation {
  id: string;
  createdAt: string;
  category: RecommendationCategory;
  title: string;
  body: string;
  metaRef: string | null;
  status: RecommendationStatus;
}

export async function getMarketingRecommendations(): Promise<MarketingRecommendation[]> {
  const sql = getDb();
  const rows = await sql`
    select id, created_at, category, title, body, meta_ref, status
    from agency_marketing_recommendations
    order by (status = 'open') desc, created_at desc
    limit 100
  `;
  return rows.map((r: any) => ({
    id: r.id,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    category: r.category,
    title: r.title,
    body: r.body,
    metaRef: r.meta_ref,
    status: r.status,
  }));
}

export interface NewRecommendationInput {
  category: RecommendationCategory;
  title: string;
  body: string;
  metaRef?: string | null;
}

/** Insert used by the /api/marketing/recommendations route — the weekly Meta Ad Manager agent's
 * only way to write here, same shared-secret auth pattern as the metrics sync route. */
export async function insertMarketingRecommendation(input: NewRecommendationInput): Promise<void> {
  const sql = getDb();
  await sql`
    insert into agency_marketing_recommendations (category, title, body, meta_ref)
    values (${input.category}, ${input.title}, ${input.body}, ${input.metaRef ?? null})
  `;
}

export async function updateRecommendationStatus(id: string, status: RecommendationStatus): Promise<void> {
  const sql = getDb();
  await sql`update agency_marketing_recommendations set status = ${status} where id = ${id}`;
}

export interface MarketingCreative {
  id: string;
  metaCreativeId: string;
  adName: string;
  headline: string | null;
  bodyCopy: string | null;
  status: string;
  hasImage: boolean;
  updatedAt: string;
}

/** Metadata only — image bytes are served separately via getMarketingCreativeImage, so this list
 * stays cheap even with many creatives. */
export async function getMarketingCreatives(): Promise<MarketingCreative[]> {
  const sql = getDb();
  const rows = await sql`
    select id, meta_creative_id, ad_name, headline, body_copy, status, (image_data is not null) as has_image, updated_at
    from agency_marketing_creatives
    order by (status = 'ACTIVE') desc, updated_at desc
    limit 50
  `;
  return rows.map((r: any) => ({
    id: r.id,
    metaCreativeId: r.meta_creative_id,
    adName: r.ad_name,
    headline: r.headline,
    bodyCopy: r.body_copy,
    status: r.status,
    hasImage: r.has_image,
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  }));
}

export async function getMarketingCreativeImage(id: string): Promise<{ data: Buffer; contentType: string } | null> {
  const sql = getDb();
  const rows = await sql`select image_data, image_content_type from agency_marketing_creatives where id = ${id}`;
  const row = rows[0];
  if (!row || !row.image_data) return null;
  return { data: row.image_data, contentType: row.image_content_type ?? "image/jpeg" };
}

export interface NewCreativeInput {
  metaCreativeId: string;
  adName: string;
  headline?: string | null;
  bodyCopy?: string | null;
  status: string;
  imageBase64?: string | null;
  imageContentType?: string | null;
}

/** Upsert used by /api/marketing/creatives — keyed on Meta's own creative id, keeping a single
 * living row per creative rather than accumulating history. Image bytes are only overwritten when
 * a new one is supplied, so a metadata-only refresh (e.g. a status flip) doesn't have to
 * re-upload the image. */
export async function upsertMarketingCreative(input: NewCreativeInput): Promise<void> {
  const sql = getDb();
  if (input.imageBase64) {
    const buf = Buffer.from(input.imageBase64, "base64");
    await sql`
      insert into agency_marketing_creatives (meta_creative_id, ad_name, headline, body_copy, status, image_data, image_content_type, updated_at)
      values (${input.metaCreativeId}, ${input.adName}, ${input.headline ?? null}, ${input.bodyCopy ?? null}, ${input.status}, ${buf}, ${input.imageContentType ?? "image/jpeg"}, now())
      on conflict (meta_creative_id) do update set
        ad_name = excluded.ad_name, headline = excluded.headline, body_copy = excluded.body_copy,
        status = excluded.status, image_data = excluded.image_data, image_content_type = excluded.image_content_type, updated_at = now()
    `;
  } else {
    await sql`
      insert into agency_marketing_creatives (meta_creative_id, ad_name, headline, body_copy, status, updated_at)
      values (${input.metaCreativeId}, ${input.adName}, ${input.headline ?? null}, ${input.bodyCopy ?? null}, ${input.status}, now())
      on conflict (meta_creative_id) do update set
        ad_name = excluded.ad_name, headline = excluded.headline, body_copy = excluded.body_copy,
        status = excluded.status, updated_at = now()
    `;
  }
}
