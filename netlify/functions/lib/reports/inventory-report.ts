// Parses the per-SKU Inventory Report pages at reports.flagshipgrowth.com — same static-HTML,
// no-API situation as the weekly Sales/Ads report (see weekly-report.ts). The page actually has
// TWO tables ("PO Replenishment" and "FBA Inventory Status — Detail"); we want the second one,
// identified by its header set (Total Stocks/Weeks Left) rather than position, since section
// order isn't guaranteed to be identical across every brand's page.

export interface InventoryReportItem {
  asin: string | null;
  sku: string | null;
  title: string | null;
  listingStatus: string | null;
  fulfilledBy: string | null;
  totalStocks: number | null;
  availableFba: number | null;
  inbound: number | null;
  wklyAvg: number | null;
  l30Sold: number | null;
  weeksLeft: number | null;
}

export interface InventoryReportData {
  items: InventoryReportItem[];
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/&middot;/g, "·").replace(/&mdash;/g, "—").replace(/\s+/g, " ").trim();
}

function toNumber(text: string): number | null {
  const cleaned = text.replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

// Split a <table>...</table> block into its <thead> header texts and <tbody> row cell HTML.
function extractTables(html: string): { headers: string[]; rowsHtml: string[] }[] {
  const tables: { headers: string[]; rowsHtml: string[] }[] = [];
  for (const tableMatch of html.matchAll(/<table[^>]*>(.*?)<\/table>/gs)) {
    const tableHtml = tableMatch[1];
    const headers = [...tableHtml.matchAll(/<th[^>]*>(.*?)<\/th>/gs)].map((m) => stripTags(m[1]));
    const rowsHtml = [...tableHtml.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)]
      .map((m) => m[1])
      .filter((row) => row.includes("<td"));
    tables.push({ headers, rowsHtml });
  }
  return tables;
}

function parseRow(rowHtml: string): InventoryReportItem | null {
  const cells = [...rowHtml.matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map((m) => m[1]);
  if (cells.length < 9) return null;

  const productCell = cells[0];
  const titleMatch = productCell.match(/^(.*?)<br/s);
  const title = titleMatch ? stripTags(titleMatch[1]) : stripTags(productCell);
  const asinMatch = productCell.match(/ASIN:\s*([A-Z0-9]+)/);
  const skuMatch = productCell.match(/SKU:\s*([^<]+?)(?:\s*$|<)/);

  return {
    asin: asinMatch ? asinMatch[1].trim() : null,
    sku: skuMatch ? skuMatch[1].trim() : null,
    title,
    listingStatus: stripTags(cells[1]) || null,
    fulfilledBy: stripTags(cells[2]) || null,
    totalStocks: toNumber(stripTags(cells[3])),
    availableFba: toNumber(stripTags(cells[4])),
    inbound: toNumber(stripTags(cells[5])),
    wklyAvg: toNumber(stripTags(cells[6])),
    l30Sold: toNumber(stripTags(cells[7])),
    weeksLeft: toNumber(stripTags(cells[8])),
  };
}

export function parseInventoryReport(html: string): InventoryReportData | null {
  const tables = extractTables(html);
  const detailTable = tables.find(
    (t) => t.headers.some((h) => h.toLowerCase().includes("total stocks")) && t.headers.some((h) => h.toLowerCase().includes("weeks left"))
  );
  if (!detailTable) return null;

  const items = detailTable.rowsHtml.map(parseRow).filter((item): item is InventoryReportItem => item !== null);
  return { items };
}

export async function fetchInventoryReport(url: string): Promise<InventoryReportData | null> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch inventory report ${url} (${res.status})`);
  }
  const html = await res.text();
  return parseInventoryReport(html);
}
