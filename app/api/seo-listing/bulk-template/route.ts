// Downloadable starting point for the bulk-upload form (app/internal/brand/[brandId]/seo-bulk) —
// headers must exactly match what bulk-upload/route.ts expects (case-insensitive, trimmed).
const TEMPLATE = `Product Name,SKU,Website URL,Priority
Example Product Name,SKU-001,https://example.com/products/example,med
`;

export async function GET() {
  return new Response(TEMPLATE, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="seo-listing-bulk-template.csv"',
    },
  });
}
