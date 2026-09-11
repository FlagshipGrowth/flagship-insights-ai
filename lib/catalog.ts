import { getDb } from "./db";

export async function getProductsForBrand(brandId: string) {
  const sql = getDb();
  return sql`
    select asin, title, status, category, sub_category, product_type, upc,
           cost_landed, msrp, unit_weight, case_qty, case_weight, case_length, case_width, case_height,
           last_synced_at
    from products
    where brand_id = ${brandId}
    order by (status = 'discontinued'), asin
  `;
}
