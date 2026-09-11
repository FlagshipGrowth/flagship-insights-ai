import { getDb } from "./db";

export const OPTIMIZATION_CATEGORIES = ["technical", "on_page", "content", "keywords", "backlinks", "other"] as const;
export type OptimizationCategory = (typeof OPTIMIZATION_CATEGORIES)[number];

export async function getProductOptimizations(brandId: string) {
  const sql = getDb();
  return sql`
    select id, title, category, description, priority, status, client_comment, created_at, reviewed_at
    from product_optimizations
    where brand_id = ${brandId}
    order by
      case status when 'pending' then 0 else 1 end,
      case priority when 'high' then 0 when 'medium' then 1 else 2 end,
      created_at desc
  `;
}

export async function getBrandName(brandId: string) {
  const sql = getDb();
  const rows = await sql`select name from brands where id = ${brandId}`;
  return rows[0]?.name as string | undefined;
}

export async function brandBelongsToClient(brandId: string, clientId: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`select 1 from brands where id = ${brandId} and client_id = ${clientId}`;
  return rows.length > 0;
}
