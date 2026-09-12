// Parses the weekly Sales/Ads report pages at reports.flagshipgrowth.com (see
// brands.weekly_report_urls, migration 0013). These are plain static HTML — no API, no
// auth — with the daily-sales chart data embedded as a literal JS array in an inline
// <script> tag, and the KPI tiles as a consistent, hand-authored div structure. Fetching
// this page IS the live read: nothing is downloaded/cached beyond what a normal HTTP
// response already is, matching the "always refresh from the live source" rule this
// project uses for the Google Sheets catalog sync too.

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

// KPI tile label -> metrics_daily metric_key. Percent-ish values (tacos/ctr/cvr) are stored as
// their raw percentage points (20.5, not 0.205) — simplest to reproduce faithfully from the
// page's own "20.5%" text, and the chart just labels the axis "%" for those keys.
const KPI_LABEL_TO_KEY: Record<string, string> = {
  "Units Sold": "units_sold",
  "Ad Spend": "ad_spend",
  "PPC Revenue": "ppc_revenue",
  ROAS: "roas",
  TACoS: "tacos",
  CTR: "ctr",
  CVR: "cvr",
};

export interface WeeklyReportData {
  weekStart: string; // ISO date, e.g. "2026-08-30"
  weekEnd: string;
  dailySales: { date: string; value: number }[];
  kpis: Record<string, number>;
}

function extractYear(html: string): number {
  const m = html.match(/header-period">[^<]*,\s*(\d{4})<\/div>/);
  return m ? Number(m[1]) : new Date().getUTCFullYear();
}

function parseDayLabel(day: string, year: number): string | null {
  // e.g. "Sun Aug 30" -> "2026-08-30"
  const parts = day.trim().split(/\s+/);
  if (parts.length < 3) return null;
  const month = MONTHS[parts[1]];
  const dayNum = Number(parts[2]);
  if (month === undefined || !Number.isFinite(dayNum)) return null;
  return new Date(Date.UTC(year, month, dayNum)).toISOString().slice(0, 10);
}

function extractDailySales(html: string, year: number): { date: string; value: number }[] {
  const m = html.match(/var data\s*=\s*(\[.*?\]);/s);
  if (!m) return [];
  let raw: { day: string; val: number }[];
  try {
    raw = JSON.parse(m[1]);
  } catch {
    return [];
  }
  return raw
    .map((d) => ({ date: parseDayLabel(d.day, year), value: d.val }))
    .filter((d): d is { date: string; value: number } => d.date !== null);
}

function extractLabeledNumbers(html: string, valueThenLabel: boolean): { label: string; value: number }[] {
  // Handles both "<div class=\"kpi-value\">X</div><div class=\"kpi-label\">Y</div>" (value first)
  // and "<div class=\"ovp-label\">Y</div><div class=\"ovp-value\">X</div>" (label first) layouts.
  const pattern = valueThenLabel
    ? /<div class="kpi-value">([^<]*)<\/div>\s*<div class="kpi-label">([^<]*)<\/div>/g
    : /<div class="ovp-label">([^<]*)<\/div>\s*<div class="ovp-value">([^<]*)<\/div>/g;
  const out: { label: string; value: number }[] = [];
  for (const match of html.matchAll(pattern)) {
    const [, a, b] = match;
    const [rawValue, label] = valueThenLabel ? [a, b] : [b, a];
    const num = parseFloat(rawValue.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(num)) out.push({ label: label.trim(), value: num });
  }
  return out;
}

function extractKpis(html: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { label, value } of extractLabeledNumbers(html, true)) {
    const key = KPI_LABEL_TO_KEY[label];
    if (key) out[key] = value;
  }
  for (const { label, value } of extractLabeledNumbers(html, false)) {
    if (label === "Organic Revenue") out.organic_revenue = value;
  }
  return out;
}

export function parseWeeklyReport(html: string): WeeklyReportData | null {
  const year = extractYear(html);
  const dailySales = extractDailySales(html, year);
  const kpis = extractKpis(html);
  if (dailySales.length === 0 && Object.keys(kpis).length === 0) return null;

  const dates = dailySales.map((d) => d.date).sort();
  return {
    weekStart: dates[0] ?? new Date().toISOString().slice(0, 10),
    weekEnd: dates[dates.length - 1] ?? new Date().toISOString().slice(0, 10),
    dailySales,
    kpis,
  };
}

export async function fetchWeeklyReport(url: string): Promise<WeeklyReportData | null> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch weekly report ${url} (${res.status})`);
  }
  const html = await res.text();
  return parseWeeklyReport(html);
}
