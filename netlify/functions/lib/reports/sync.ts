import { getDb } from "../db";
import { fetchWeeklyReport, type WeeklyReportData } from "./weekly-report";

// A brand normally has one weekly report ("amazon"), but Hapad has separate US/Canada reports
// under one brand row (see brands.weekly_report_urls) — the label distinguishes them as their
// own channel so their metrics_daily rows don't collide.
function channelForLabel(label: string | null): string {
  if (!label) return "amazon";
  return `amazon-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
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
  const brands = (await sql`
    select id, weekly_report_urls
    from brands
    where jsonb_array_length(weekly_report_urls) > 0
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
