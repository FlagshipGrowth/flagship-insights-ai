import { getDb } from "./db";

export interface ReportLink {
  label: string | null;
  url: string;
}

export interface BrandReportLinks {
  weeklyReportUrls: ReportLink[];
  inventoryReportUrls: ReportLink[];
}

// Weekly Sales/Ads and Inventory dashboards live at reports.flagshipgrowth.com, refreshed by
// Joey's own pipeline every Monday/Tuesday — we just link out to them, there's nothing to sync
// on our end. See migration 0013_add-brand-report-links for the per-brand URLs.
export async function getBrandReportLinks(brandId: string): Promise<BrandReportLinks> {
  const sql = getDb();
  const rows = await sql`
    select weekly_report_urls, inventory_report_urls from brands where id = ${brandId}
  `;
  const row = rows[0];
  return {
    weeklyReportUrls: (row?.weekly_report_urls ?? []) as ReportLink[],
    inventoryReportUrls: (row?.inventory_report_urls ?? []) as ReportLink[],
  };
}
