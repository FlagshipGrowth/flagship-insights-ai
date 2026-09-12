import { getDb } from "./db";

export interface ReportLink {
  label: string | null;
  url: string;
}

export interface BrandReportLinks {
  weeklyReportUrls: ReportLink[];
  inventoryReportUrls: ReportLink[];
  reconciliationReportUrls: ReportLink[];
}

// Weekly Sales/Ads, Inventory, and Reconciliation dashboards live at reports.flagshipgrowth.com,
// refreshed by Joey's own pipeline every Monday/Tuesday — this just gets the outbound links for
// the "Reports" section. See migrations 0013/0014 for the per-brand URLs, and
// netlify/functions/lib/reports/ for the sync that also pulls the underlying data in for the
// dashboard previews (getInventoryPreview, getReconciliationSummary below).
export async function getBrandReportLinks(brandId: string): Promise<BrandReportLinks> {
  const sql = getDb();
  const rows = await sql`
    select weekly_report_urls, inventory_report_urls, reconciliation_report_urls from brands where id = ${brandId}
  `;
  const row = rows[0];
  return {
    weeklyReportUrls: (row?.weekly_report_urls ?? []) as ReportLink[],
    inventoryReportUrls: (row?.inventory_report_urls ?? []) as ReportLink[],
    reconciliationReportUrls: (row?.reconciliation_report_urls ?? []) as ReportLink[],
  };
}

export interface InventoryPreviewItem {
  region: string;
  asin: string | null;
  sku: string | null;
  title: string | null;
  availableFba: number | null;
  wklyAvg: number | null;
  weeksLeft: number | null;
}

export interface InventoryPreview {
  totalSkus: number;
  totalAvailable: number;
  criticalSkus: number; // weeks_left <= 4, matching the report's own "Critical" threshold
  items: InventoryPreviewItem[]; // most urgent (lowest weeks_left) first, capped
  syncedAt: string | null;
}

const INVENTORY_PREVIEW_LIMIT = 6;
const CRITICAL_WEEKS_THRESHOLD = 4;

export async function getInventoryPreview(brandId: string): Promise<InventoryPreview | null> {
  const sql = getDb();
  const rows = await sql`
    select region, asin, sku, title, available_fba, wkly_avg, weeks_left, synced_at
    from inventory_report_items
    where brand_id = ${brandId}
    order by weeks_left asc nulls last
  `;
  if (rows.length === 0) return null;

  const totalAvailable = rows.reduce((sum: number, r: any) => sum + (r.available_fba != null ? Number(r.available_fba) : 0), 0);
  const criticalSkus = rows.filter((r: any) => r.weeks_left != null && Number(r.weeks_left) <= CRITICAL_WEEKS_THRESHOLD).length;
  const syncedAt = rows.reduce((latest: string | null, r: any) => {
    const iso = r.synced_at instanceof Date ? r.synced_at.toISOString() : String(r.synced_at);
    return !latest || iso > latest ? iso : latest;
  }, null);

  return {
    totalSkus: rows.length,
    totalAvailable,
    criticalSkus,
    syncedAt,
    items: rows.slice(0, INVENTORY_PREVIEW_LIMIT).map((r: any) => ({
      region: r.region || "",
      asin: r.asin,
      sku: r.sku,
      title: r.title,
      availableFba: r.available_fba != null ? Number(r.available_fba) : null,
      wklyAvg: r.wkly_avg != null ? Number(r.wkly_avg) : null,
      weeksLeft: r.weeks_left != null ? Number(r.weeks_left) : null,
    })),
  };
}

export interface ReconciliationPreview {
  valueRecovered: number | null;
  totalShipments: number | null;
  shipmentDiscrepancy: number | null;
  casesResolved: number | null;
  syncedAt: string;
}

export async function getReconciliationSummary(brandId: string): Promise<ReconciliationPreview | null> {
  const sql = getDb();
  const rows = await sql`
    select value_recovered, total_shipments, shipment_discrepancy, cases_resolved, synced_at
    from reconciliation_summary
    where brand_id = ${brandId}
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    valueRecovered: row.value_recovered != null ? Number(row.value_recovered) : null,
    totalShipments: row.total_shipments != null ? Number(row.total_shipments) : null,
    shipmentDiscrepancy: row.shipment_discrepancy != null ? Number(row.shipment_discrepancy) : null,
    casesResolved: row.cases_resolved != null ? Number(row.cases_resolved) : null,
    syncedAt: row.synced_at instanceof Date ? row.synced_at.toISOString() : String(row.synced_at),
  };
}
