import { getUserContext, isOwner } from "@/lib/user-context";
import { insertLead } from "@/lib/leads";
import { parseLeadsBulkCsv } from "@/lib/leads-bulk";

/** Handles the "Bulk upload leads" form on app/internal/crm/bulk-upload — same shape as
 * app/api/seo-listing/bulk-upload/route.ts: parse+validate synchronously (fast, no external
 * calls), then insert. Small enough (a CSV of leads) that there's no need to defer to a
 * background function the way the SEO bulk upload does for its per-row Slack posts. */
export async function POST(req: Request) {
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) {
    return new Response("Not authorized", { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return redirectWithMessage(req, "Missing file.");

  const text = await file.text();
  const { rows, skipped } = parseLeadsBulkCsv(text);

  if (rows.length === 0) {
    return redirectWithMessage(req, "No valid rows found — check Company Name is filled in for every row.");
  }

  for (const row of rows) {
    await insertLead(row);
  }

  const url = new URL("/internal/crm/bulk-upload", req.url);
  url.searchParams.set("queued", String(rows.length));
  if (skipped > 0) url.searchParams.set("skipped", String(skipped));
  return Response.redirect(url, 303);
}

function redirectWithMessage(req: Request, message: string): Response {
  const url = new URL("/internal/crm/bulk-upload", req.url);
  url.searchParams.set("error", message);
  return Response.redirect(url, 303);
}
