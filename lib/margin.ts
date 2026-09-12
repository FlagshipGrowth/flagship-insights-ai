import { getDb } from "./db";

export interface SavedMarginInputs {
  productId: string;
  price: number | null;
  cogs: number | null;
  referralPct: number | null;
  fbaFee: number | null;
  inbound: number | null;
  storage: number | null;
  fulfillmentCost: number | null;
  returns: number | null;
  adsSpend: number | null;
}

export async function getMarginInputsForBrand(brandId: string): Promise<SavedMarginInputs[]> {
  const sql = getDb();
  const rows = await sql`
    select m.product_id, m.price, m.cogs, m.referral_pct, m.fba_fee, m.inbound, m.storage,
           m.fulfillment_cost, m.returns, m.ads_spend
    from margin_calculator_inputs m
    join products p on p.id = m.product_id
    where p.brand_id = ${brandId}
  `;
  return rows.map((r: any) => ({
    productId: r.product_id,
    price: r.price != null ? Number(r.price) : null,
    cogs: r.cogs != null ? Number(r.cogs) : null,
    referralPct: r.referral_pct != null ? Number(r.referral_pct) : null,
    fbaFee: r.fba_fee != null ? Number(r.fba_fee) : null,
    inbound: r.inbound != null ? Number(r.inbound) : null,
    storage: r.storage != null ? Number(r.storage) : null,
    fulfillmentCost: r.fulfillment_cost != null ? Number(r.fulfillment_cost) : null,
    returns: r.returns != null ? Number(r.returns) : null,
    adsSpend: r.ads_spend != null ? Number(r.ads_spend) : null,
  }));
}

export interface MarginInputEntry {
  productId: string;
  price: number | null;
  cogs: number | null;
  referralPct: number | null;
  fbaFee: number | null;
  inbound: number | null;
  storage: number | null;
  fulfillmentCost: number | null;
  returns: number | null;
  adsSpend: number | null;
}

// Only touches product_ids that actually belong to brandId — entries come from the client, and
// while this is an internal-staff-only tool, there's no reason to trust a productId blindly.
export async function saveMarginInputs(brandId: string, entries: MarginInputEntry[]): Promise<void> {
  const sql = getDb();
  for (const e of entries) {
    await sql`
      insert into margin_calculator_inputs (
        product_id, price, cogs, referral_pct, fba_fee, inbound, storage, fulfillment_cost, returns, ads_spend, updated_at
      )
      select ${e.productId}, ${e.price}, ${e.cogs}, ${e.referralPct}, ${e.fbaFee}, ${e.inbound}, ${e.storage},
             ${e.fulfillmentCost}, ${e.returns}, ${e.adsSpend}, now()
      where exists (select 1 from products where id = ${e.productId} and brand_id = ${brandId})
      on conflict (product_id) do update set
        price = excluded.price,
        cogs = excluded.cogs,
        referral_pct = excluded.referral_pct,
        fba_fee = excluded.fba_fee,
        inbound = excluded.inbound,
        storage = excluded.storage,
        fulfillment_cost = excluded.fulfillment_cost,
        returns = excluded.returns,
        ads_spend = excluded.ads_spend,
        updated_at = excluded.updated_at
    `;
  }
}
