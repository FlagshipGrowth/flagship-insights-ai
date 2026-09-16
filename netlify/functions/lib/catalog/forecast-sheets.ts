import { getDb } from "../db";

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

async function fetchSheetRowsByTitle(spreadsheetId: string, title: string, accessToken: string): Promise<string[][]> {
  const range = encodeURIComponent(`'${title}'`);
  const url = `${SHEETS_API}/${spreadsheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new Error(`Failed to read sheet values for ${spreadsheetId} (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { values?: unknown[][] };
  return (data.values ?? []).map((row) => row.map((cell) => (cell == null ? "" : String(cell))));
}

/** Every brand's sheet was built independently, so there's no reliable gid to configure ahead of
 * time the way there is for Specs (0010) — find the forecast tab by title at sync time instead.
 * Prefers a tab literally titled "Forecast (Baseline)" (the agency's own standard template, seen
 * blank on a fresh onboarding brand's sheet and filled with real numbers on active ones); falls
 * back to the first tab whose title merely contains "forecast". Deliberately does NOT match a
 * brand's channel-specific forecast tab (e.g. TUBR's "TTS Forecast", a completely different row
 * layout) — callers should treat a non-matching tab shape as "no forecast data", not force it. */
async function findForecastTabTitle(spreadsheetId: string, accessToken: string): Promise<string | null> {
  const url = `${SHEETS_API}/${spreadsheetId}?fields=sheets.properties(sheetId,title)`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new Error(`Failed to read spreadsheet metadata for ${spreadsheetId} (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { sheets: { properties: { sheetId: number; title: string } }[] };
  const titles = data.sheets.map((s) => s.properties.title);
  const exact = titles.find((t) => t.trim().toLowerCase() === "forecast (baseline)");
  if (exact) return exact;
  return titles.find((t) => t.trim().toLowerCase().includes("forecast")) ?? null;
}

// Row label -> our metric_key, matched case-insensitively against the label cell that sits one
// column to the left of the Jan..Dec run. "2026 FORECAST REVENUE" is matched separately below
// since it carries the year in the label itself.
const LABEL_METRICS: Record<string, string> = {
  "actual revenue": "actual_revenue",
  "organic revenue": "organic_revenue",
  "advertising revenue": "advertising_revenue",
  "forecast ad budget": "forecast_ad_budget",
  "actual ad spend": "actual_ad_spend",
  "forecast tacos": "forecast_tacos",
  "actual tacos": "actual_tacos",
};

const FORECAST_REVENUE_LABEL = /^(\d{4})\s+forecast revenue$/i;

export interface ForecastRow {
  year: number;
  month: number; // 1-12
  metricKey: string;
  value: number;
}

/** Finds the first row whose cells, starting at some column, read Jan/Feb/.../Dec (case
 * insensitive) — the standard baseline-forecast tab's header. Returns the row index and the
 * column index of "Jan" (metric labels live one column to its left). */
function findMonthHeaderRow(rows: string[][]): { rowIndex: number; janCol: number } | null {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length - 11; c++) {
      const slice = row.slice(c, c + 12).map((cell) => cell.trim().toLowerCase());
      if (slice.every((cell, i) => cell === MONTH_NAMES[i])) {
        return { rowIndex: r, janCol: c };
      }
    }
  }
  return null;
}

function parseMoney(value: string | undefined): number | null {
  if (value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Parses just the first Forecast/Actual block below the month header — a brand's sheet may
 * repeat the same header + label set further down (a second scenario/draft block); only the
 * first is treated as authoritative, matching the plan's "don't guess, don't double-count"
 * approach elsewhere in this sync. */
export function parseForecastRows(rows: string[][]): ForecastRow[] {
  const header = findMonthHeaderRow(rows);
  if (!header) return [];
  const { rowIndex, janCol } = header;
  const labelCol = janCol - 1;
  if (labelCol < 0) return [];

  const out: ForecastRow[] = [];
  let year: number | null = null;
  const seen = new Set<string>();

  for (let r = rowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    const rawLabel = (row[labelCol] ?? "").trim();
    if (!rawLabel) continue;

    const revenueMatch = rawLabel.match(FORECAST_REVENUE_LABEL);
    let metricKey: string | null = null;
    if (revenueMatch) {
      year = Number(revenueMatch[1]);
      metricKey = "forecast_revenue";
    } else {
      metricKey = LABEL_METRICS[rawLabel.toLowerCase()] ?? null;
    }
    if (!metricKey) continue;
    if (seen.has(metricKey)) break; // hit a second stacked block — stop, first block only
    seen.add(metricKey);
    if (year === null) continue; // shouldn't happen (forecast_revenue row always comes first), but be safe

    for (let m = 0; m < 12; m++) {
      const value = parseMoney(row[janCol + m]);
      if (value === null) continue;
      out.push({ year, month: m + 1, metricKey, value });
    }
  }
  return out;
}

export interface ForecastSyncResult {
  brandId: string;
  rowCount: number;
  tabFound: boolean;
}

export async function upsertBrandForecasts(brandId: string, rows: ForecastRow[]): Promise<void> {
  const sql = getDb();
  for (const r of rows) {
    await sql`
      insert into brand_forecasts (brand_id, year, month, metric_key, value, synced_at)
      values (${brandId}, ${r.year}, ${r.month}, ${r.metricKey}, ${r.value}, now())
      on conflict (brand_id, year, month, metric_key) do update set
        value = excluded.value,
        synced_at = excluded.synced_at
    `;
  }
}

export async function syncBrandForecast(
  brandId: string,
  spreadsheetId: string,
  accessToken: string
): Promise<ForecastSyncResult> {
  const tabTitle = await findForecastTabTitle(spreadsheetId, accessToken);
  if (!tabTitle) return { brandId, rowCount: 0, tabFound: false };

  const rawRows = await fetchSheetRowsByTitle(spreadsheetId, tabTitle, accessToken);
  const parsed = parseForecastRows(rawRows);
  await upsertBrandForecasts(brandId, parsed);
  return { brandId, rowCount: parsed.length, tabFound: true };
}

/** Syncs every brand that has a linked Google Sheet, reusing the same access token minted by the
 * catalog sync (see google-sheets.ts's getAccessToken) — pass it in rather than minting a second
 * one for the same run. Brand failures don't stop the run. */
export async function syncAllForecasts(accessToken: string): Promise<{ synced: number; failed: number }> {
  const sql = getDb();
  const brands = (await sql`
    select id, google_sheet_id from brands where google_sheet_id is not null
  `) as { id: string; google_sheet_id: string }[];

  const results = await Promise.allSettled(
    brands.map((b) => syncBrandForecast(b.id, b.google_sheet_id, accessToken))
  );

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.error(`forecast-sync: ${failures.length}/${brands.length} brands failed`, failures);
  }
  return { synced: brands.length - failures.length, failed: failures.length };
}
