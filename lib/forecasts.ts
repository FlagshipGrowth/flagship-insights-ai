import { getDb } from "./db";

export interface BrandForecastMonth {
  year: number;
  month: number;
  forecastRevenue: number | null;
  actualRevenue: number | null;
  organicRevenue: number | null;
  advertisingRevenue: number | null;
  forecastAdBudget: number | null;
  actualAdSpend: number | null;
  forecastTacos: number | null;
  actualTacos: number | null;
}

// Pulled from the brand's own "Forecast (Baseline)" Google Sheet tab (see
// netlify/functions/lib/catalog/forecast-sheets.ts) — only brands with that exact tab have rows.
export async function getBrandForecast(brandId: string, year: number): Promise<BrandForecastMonth[]> {
  const sql = getDb();
  const rows = await sql`
    select month, metric_key, value
    from brand_forecasts
    where brand_id = ${brandId} and year = ${year}
    order by month
  `;
  const byMonth = new Map<number, BrandForecastMonth>();
  for (const r of rows as { month: number; metric_key: string; value: string }[]) {
    if (!byMonth.has(r.month)) {
      byMonth.set(r.month, {
        year,
        month: r.month,
        forecastRevenue: null,
        actualRevenue: null,
        organicRevenue: null,
        advertisingRevenue: null,
        forecastAdBudget: null,
        actualAdSpend: null,
        forecastTacos: null,
        actualTacos: null,
      });
    }
    const entry = byMonth.get(r.month)!;
    const value = Number(r.value);
    switch (r.metric_key) {
      case "forecast_revenue": entry.forecastRevenue = value; break;
      case "actual_revenue": entry.actualRevenue = value; break;
      case "organic_revenue": entry.organicRevenue = value; break;
      case "advertising_revenue": entry.advertisingRevenue = value; break;
      case "forecast_ad_budget": entry.forecastAdBudget = value; break;
      case "actual_ad_spend": entry.actualAdSpend = value; break;
      case "forecast_tacos": entry.forecastTacos = value; break;
      case "actual_tacos": entry.actualTacos = value; break;
    }
  }
  return Array.from(byMonth.values()).sort((a, b) => a.month - b.month);
}
