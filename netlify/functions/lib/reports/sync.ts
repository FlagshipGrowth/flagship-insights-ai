import { getDb } from "../db";
import { fetchWeeklyReport, type WeeklyReportData } from "./weekly-report";
import { fetchInventoryReport, type InventoryReportData } from "./inventory-report";
import { fetchReconciliationReport } from "./reconciliation-report";

// A brand normally has one report ("amazon"/""), but Hapad has separate US/Canada reports
// under one brand row (see brands.weekly_report_urls/inventory_report_urls) — the label
// disambiguates them so their rows don't collide.
function channelForLabel(label: string | null): string {
  if (!label) return "amazon";
  return `amazon-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function regionForLabel(label: string | null): string {
  return label ? label.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "";
}

export async function syncWeeklyReportMetrics(brandId: string, channel: string, report: WeeklyReportData): Promise<void> {
  const sql = getDb();
  for (const d of report.dailySales) {
    await sql`
      insert into metrics_daily (brand_id, channel, date, metric_key, value)
      values (${brandId}, ${channel}, ${d.date}, 'sales', ${d.value})
      on conflict (brand_id, channel, date, metric_key) do update set value = excluded.value
    `;
  }
  for (const [metricKey, value] of Object.entries(report.kpis)) {
    await sql`
      insert into metrics_daily (brand_id, channel, date, metric_key, value)
      values (${brandId}, ${channel}, ${report.weekEnd}, ${metricKey}, ${value})
      on conflict (brand_id, channel, date, metric_key) do update set value = excluded.value
    `;
  }
}

interface ReportUrlEntry {
  label: string | null;
  url: string;
}

/** Refetches every brand's weekly report page and folds the results into metrics_daily. Safe
 * to run daily (not just Mon/Tue) — an unchanged report just re-upserts the same values, and
 * this way a late report still gets picked up on the next run instead of needing a precise
 * schedule. Per-report failures don't stop the rest (see catalog-sync.ts for the same pattern). */
export async function syncAllWeeklyReports(): Promise<{ synced: number; failed: number }> {
  const sql = getDb();
  // Sellerise (see app/api/sellerise/sync/route.ts) is the authoritative Amazon data source for
  // any brand it's connected to — this weekly-report scrape writes into the same channel="amazon"
  // namespace with a different, older metric_key vocabulary (sales/ad_spend/organic_revenue/...),
  // and since it re-upserts on every run its dates always look "fresher" than Sellerise's actual
  // sync cadence, silently winning as the chart's default metric. Skip Sellerise-connected brands
  // here entirely — this only stops the metrics_daily write, not the report LINK itself (that's a
  // separate read of brands.weekly_report_urls via lib/reports.ts's getBrandReportLinks). Brands
  // with no Sellerise account (e.g. Aura House) still depend on this as their only real source.
  const brands = (await sql`
    select id, weekly_report_urls
    from brands
    where jsonb_array_length(weekly_report_urls) > 0 and sellerise_account_name is null
  `) as { id: string; weekly_report_urls: ReportUrlEntry[] }[];

  const targets = brands.flatMap((b) => b.weekly_report_urls.map((r) => ({ brandId: b.id, label: r.label, url: r.url })));

  const results = await Promise.allSettled(
    targets.map(async (t) => {
      const report = await fetchWeeklyReport(t.url);
      if (!report) throw new Error(`No parseable data at ${t.url}`);
      await syncWeeklyReportMetrics(t.brandId, channelForLabel(t.label), report);
    })
  );

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.error(`weekly-reports-sync: ${failures.length}/${targets.length} report fetches failed`, failures);
  }
  return { synced: targets.length - failures.length, failed: failures.length };
}

async function syncInventoryReportItems(brandId: string, region: string, report: InventoryReportData): Promise<void> {
  const sql = getDb();
  const syncedAt = new Date().toISOString();
  for (const item of report.items) {
    if (!item.asin) continue; // unique key needs one; a row with no ASIN can't be tracked reliably anyway
    await sql`
      insert into inventory_report_items (
        brand_id, region, asin, sku, title, listing_status, fulfilled_by,
        total_stocks, available_fba, inbound, wkly_avg, l30_sold, weeks_left, synced_at
      ) values (
        ${brandId}, ${region}, ${item.asin}, ${item.sku}, ${item.title}, ${item.listingStatus}, ${item.fulfilledBy},
        ${item.totalStocks}, ${item.availableFba}, ${item.inbound}, ${item.wklyAvg}, ${item.l30Sold}, ${item.weeksLeft}, ${syncedAt}
      )
      on conflict (brand_id, region, asin) do update set
        sku = excluded.sku,
        title = excluded.title,
        listing_status = excluded.listing_status,
        fulfilled_by = excluded.fulfilled_by,
        total_stocks = excluded.total_stocks,
        available_fba = excluded.available_fba,
        inbound = excluded.inbound,
        wkly_avg = excluded.wkly_avg,
        l30_sold = excluded.l30_sold,
        weeks_left = excluded.weeks_left,
        synced_at = excluded.synced_at
    `;
  }
  // Same stale-row cleanup pattern as the Catalog sync — a SKU no longer on the report
  // shouldn't linger forever.
  await sql`delete from inventory_report_items where brand_id = ${brandId} and region = ${region} and synced_at < ${syncedAt}`;
}

export async function syncAllInventoryReports(): Promise<{ synced: number; failed: number }> {
  const sql = getDb();
  const brands = (await sql`
    select id, inventory_report_urls
    from brands
    where jsonb_array_length(inventory_report_urls) > 0
  `) as { id: string; inventory_report_urls: ReportUrlEntry[] }[];

  const targets = brands.flatMap((b) => b.inventory_report_urls.map((r) => ({ brandId: b.id, label: r.label, url: r.url })));

  const results = await Promise.allSettled(
    targets.map(async (t) => {
      const report = await fetchInventoryReport(t.url);
      if (!report) throw new Error(`No parseable data at ${t.url}`);
      await syncInventoryReportItems(t.brandId, regionForLabel(t.label), report);
    })
  );

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.error(`inventory-reports-sync: ${failures.length}/${targets.length} report fetches failed`, failures);
  }
  return { synced: targets.length - failures.length, failed: failures.length };
}

export async function syncAllReconciliationReports(): Promise<{ synced: number; failed: number }> {
  const sql = getDb();
  const brands = (await sql`
    select id, reconciliation_report_urls
    from brands
    where jsonb_array_length(reconciliation_report_urls) > 0
  `) as { id: string; reconciliation_report_urls: ReportUrlEntry[] }[];

  // Every brand with a reconciliation report only has one (no region split needed).
  const targets = brands.flatMap((b) => (b.reconciliation_report_urls[0] ? [{ brandId: b.id, url: b.reconciliation_report_urls[0].url }] : []));

  const results = await Promise.allSettled(
    targets.map(async (t) => {
      const summary = await fetchReconciliationReport(t.url);
      if (!summary) throw new Error(`No parseable data at ${t.url}`);
      await sql`
        insert into reconciliation_summary (brand_id, value_recovered, total_shipments, shipment_discrepancy, cases_resolved, synced_at)
        values (${t.brandId}, ${summary.valueRecovered}, ${summary.totalShipments}, ${summary.shipmentDiscrepancy}, ${summary.casesResolved}, now())
        on conflict (brand_id) do update set
          value_recovered = excluded.value_recovered,
          total_shipments = excluded.total_shipments,
          shipment_discrepancy = excluded.shipment_discrepancy,
          cases_resolved = excluded.cases_resolved,
          synced_at = excluded.synced_at
      `;
    })
  );

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.error(`reconciliation-reports-sync: ${failures.length}/${targets.length} report fetches failed`, failures);
  }
  return { synced: targets.length - failures.length, failed: failures.length };
}
