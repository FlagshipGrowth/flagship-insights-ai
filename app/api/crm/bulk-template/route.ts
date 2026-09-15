// Headers must match lib/leads-bulk.ts's HEADER_ALIASES (case-insensitive, trimmed).
const TEMPLATE = `Company Name,Contact Name,Email,Source,Estimated Value,Stage,Notes
Example Co,Jane Smith,jane@example.com,Referral,50000,new,Warm intro from a past client
`;

export async function GET() {
  return new Response(TEMPLATE, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="crm-leads-bulk-template.csv"',
    },
  });
}
