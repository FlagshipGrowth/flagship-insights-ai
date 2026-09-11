import { getDb } from "./db";

export async function getProductsForBrand(brandId: string) {
  const sql = getDb();
  return sql`
    select id, asin, sku, title, status, category, sub_category, product_type, upc,
           cost_landed, msrp, unit_weight, case_qty, case_weight, case_length, case_width, case_height,
           last_synced_at
    from products
    where brand_id = ${brandId}
    order by (status = 'discontinued'), sku, asin
  `;
}

export interface NewProductInput {
  title: string | null;
  sku: string | null;
  status: "active" | "discontinued" | null;
  category: string | null;
  subCategory: string | null;
  productType: string | null;
  upc: string | null;
  costLanded: number | null;
  msrp: number | null;
  unitWeight: number | null;
  caseQty: number | null;
  caseWeight: number | null;
  caseLength: number | null;
  caseWidth: number | null;
  caseHeight: number | null;
}

// Manually-added products get no asin and last_synced_at stays null — the catalog sync's
// stale-row cleanup (netlify/functions/lib/catalog/google-sheets.ts) only deletes rows it
// didn't just touch, and a null last_synced_at never satisfies that comparison, so these
// survive every sync run untouched.
export async function addProduct(brandId: string, input: NewProductInput): Promise<void> {
  const sql = getDb();
  await sql`
    insert into products (
      brand_id, sku, title, status, category, sub_category, product_type, upc,
      cost_landed, msrp, unit_weight, case_qty, case_weight, case_length, case_width, case_height
    ) values (
      ${brandId}, ${input.sku}, ${input.title}, ${input.status}, ${input.category}, ${input.subCategory},
      ${input.productType}, ${input.upc}, ${input.costLanded}, ${input.msrp}, ${input.unitWeight},
      ${input.caseQty}, ${input.caseWeight}, ${input.caseLength}, ${input.caseWidth}, ${input.caseHeight}
    )
  `;
}
