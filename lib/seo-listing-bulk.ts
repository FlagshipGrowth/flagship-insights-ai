import { csvToRecords } from "./csv";

// Shared between the two ways a bulk SEO listing CSV can arrive: the dashboard upload form
// (app/api/seo-listing/bulk-upload/route.ts) and the file_input block inside the /seo-listing
// Slack modal itself (app/api/slack/interactions/route.ts) — same validation either way.
export const SEO_LISTING_PRIORITY_VALUES = ["low", "med", "high"] as const;

// A few header spellings people are likely to type/paste; the template (bulk-template/route.ts)
// always uses the first of each.
const HEADER_ALIASES: Record<string, string> = {
  "product name": "productName",
  product: "productName",
  sku: "sku",
  "website url": "productUrl",
  "website product page url": "productUrl",
  url: "productUrl",
  priority: "priority",
};

export interface SeoListingBulkRow {
  productName: string;
  sku: string | null;
  productUrl: string;
  priority: string | null;
}

export function parseSeoListingBulkCsv(text: string): { rows: SeoListingBulkRow[]; skipped: number } {
  const records = csvToRecords(text);
  const rows: SeoListingBulkRow[] = [];
  let skipped = 0;

  for (const record of records) {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(record)) {
      const mapped = HEADER_ALIASES[key.trim().toLowerCase()];
      if (mapped) normalized[mapped] = value;
    }

    const productName = normalized.productName?.trim();
    const productUrl = normalized.productUrl?.trim();
    const sku = normalized.sku?.trim() || null;
    const rawPriority = normalized.priority?.trim().toLowerCase() || null;

    if (!productName || !productUrl || !/^https?:\/\//i.test(productUrl)) {
      skipped++;
      continue;
    }
    const priority = rawPriority && (SEO_LISTING_PRIORITY_VALUES as readonly string[]).includes(rawPriority) ? rawPriority : null;
    rows.push({ productName, sku, productUrl, priority });
  }

  return { rows, skipped };
}
