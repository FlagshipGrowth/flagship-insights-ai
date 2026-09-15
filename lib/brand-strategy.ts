import { getDb } from "./db";

export interface StrategyBrief {
  icp: string | null;
  creatorProfile: string | null;
  marginTargets: string | null;
  heroSkus: string | null;
  commissionRange: string | null;
  messageTemplates: string | null;
  dailySendCap: number | null;
  budgetCeiling: number | null;
  updatedAt: string | null;
  updatedByEmail: string | null;
}

export async function getStrategyBrief(brandId: string): Promise<StrategyBrief | null> {
  const sql = getDb();
  const rows = await sql`
    select b.icp, b.creator_profile, b.margin_targets, b.hero_skus, b.commission_range,
           b.message_templates, b.daily_send_cap, b.budget_ceiling, b.updated_at, u.email as updated_by_email
    from brand_strategy_briefs b
    left join users u on u.id = b.updated_by_id
    where b.brand_id = ${brandId}
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    icp: r.icp,
    creatorProfile: r.creator_profile,
    marginTargets: r.margin_targets,
    heroSkus: r.hero_skus,
    commissionRange: r.commission_range,
    messageTemplates: r.message_templates,
    dailySendCap: r.daily_send_cap != null ? Number(r.daily_send_cap) : null,
    budgetCeiling: r.budget_ceiling != null ? Number(r.budget_ceiling) : null,
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
    updatedByEmail: r.updated_by_email,
  };
}

/** Replace-whole-row on save — this is a living document the account team corrects over time,
 * not an append log; matches the upsert-whole-row convention used elsewhere (e.g.
 * lib/marketing.ts's upsertMarketingCreative). */
export async function saveStrategyBrief(brandId: string, updatedById: string, formData: FormData): Promise<void> {
  const text = (name: string) => ((formData.get(name) as string) ?? "").trim() || null;
  const num = (name: string) => {
    const v = (formData.get(name) as string)?.trim();
    return v ? Number(v) : null;
  };

  const sql = getDb();
  await sql`
    insert into brand_strategy_briefs
      (brand_id, icp, creator_profile, margin_targets, hero_skus, commission_range, message_templates, daily_send_cap, budget_ceiling, updated_by_id, updated_at)
    values
      (${brandId}, ${text("icp")}, ${text("creatorProfile")}, ${text("marginTargets")}, ${text("heroSkus")}, ${text("commissionRange")}, ${text("messageTemplates")}, ${num("dailySendCap")}, ${num("budgetCeiling")}, ${updatedById}, now())
    on conflict (brand_id) do update set
      icp = excluded.icp, creator_profile = excluded.creator_profile, margin_targets = excluded.margin_targets,
      hero_skus = excluded.hero_skus, commission_range = excluded.commission_range, message_templates = excluded.message_templates,
      daily_send_cap = excluded.daily_send_cap, budget_ceiling = excluded.budget_ceiling,
      updated_by_id = excluded.updated_by_id, updated_at = now()
  `;
}

export interface TikTokShopConnection {
  eukaBrandId: string | null;
  eukaStoreIds: string[] | null;
  reacherShopId: string | null;
  planTier: string | null;
}

export async function getTikTokShopConnection(brandId: string): Promise<TikTokShopConnection | null> {
  const sql = getDb();
  const rows = await sql`
    select tiktok_euka_brand_id, tiktok_euka_store_ids, tiktok_reacher_shop_id, tiktok_plan_tier
    from brands where id = ${brandId}
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    eukaBrandId: r.tiktok_euka_brand_id,
    eukaStoreIds: r.tiktok_euka_store_ids,
    reacherShopId: r.tiktok_reacher_shop_id,
    planTier: r.tiktok_plan_tier,
  };
}

export async function saveTikTokShopConnection(brandId: string, formData: FormData): Promise<void> {
  const text = (name: string) => ((formData.get(name) as string) ?? "").trim() || null;
  const eukaBrandId = text("eukaBrandId");
  const reacherShopId = text("reacherShopId");
  const planTier = text("planTier");
  const storeIdsRaw = text("eukaStoreIds");
  const storeIds = storeIdsRaw ? storeIdsRaw.split(",").map((s) => s.trim()).filter(Boolean) : null;

  const sql = getDb();
  await sql`
    update brands set
      tiktok_euka_brand_id = ${eukaBrandId},
      tiktok_euka_store_ids = ${storeIds ? JSON.stringify(storeIds) : null},
      tiktok_reacher_shop_id = ${reacherShopId},
      tiktok_plan_tier = ${planTier}
    where id = ${brandId}
  `;
}
