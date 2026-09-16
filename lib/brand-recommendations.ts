import { getDb } from "./db";

export type RecommendationStatus = "open" | "actioned" | "dismissed";

export interface BrandRecommendation {
  id: string;
  brandId: string;
  source: string;
  category: string;
  severity: string | null;
  title: string;
  body: string;
  metaRef: string | null;
  status: RecommendationStatus;
  createdAt: string;
}

/** Brand-scoped, source-tagged sibling of lib/marketing.ts's agency-wide recommendations —
 * reusable by any per-brand agent (Sellerise first), not tied to one source. */
export async function getBrandRecommendations(brandId: string): Promise<BrandRecommendation[]> {
  const sql = getDb();
  const rows = await sql`
    select id, brand_id, source, category, severity, title, body, meta_ref, status, created_at
    from brand_recommendations
    where brand_id = ${brandId}
    order by (status = 'open') desc, created_at desc
    limit 100
  `;
  return rows.map((r: any) => ({
    id: r.id,
    brandId: r.brand_id,
    source: r.source,
    category: r.category,
    severity: r.severity,
    title: r.title,
    body: r.body,
    metaRef: r.meta_ref,
    status: r.status,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  }));
}

export interface NewBrandRecommendationInput {
  brandId: string;
  source: string;
  category: string;
  severity?: string | null;
  title: string;
  body: string;
  metaRef?: string | null;
}

export async function insertBrandRecommendation(input: NewBrandRecommendationInput): Promise<void> {
  const sql = getDb();
  await sql`
    insert into brand_recommendations (brand_id, source, category, severity, title, body, meta_ref)
    values (${input.brandId}, ${input.source}, ${input.category}, ${input.severity ?? null}, ${input.title}, ${input.body}, ${input.metaRef ?? null})
  `;
}

export async function updateBrandRecommendationStatus(id: string, status: RecommendationStatus): Promise<void> {
  const sql = getDb();
  await sql`update brand_recommendations set status = ${status} where id = ${id}`;
}
