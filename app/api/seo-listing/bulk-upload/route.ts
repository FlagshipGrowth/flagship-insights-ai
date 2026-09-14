import { getUserContext, isInternalStaff, canStaffAccessBrand, deriveNameFromEmail } from "@/lib/user-context";
import { getBrandName } from "@/lib/seo";
import { getBrandSlackChannelId } from "@/lib/brands";
import { parseSeoListingBulkCsv } from "@/lib/seo-listing-bulk";

/** Handles the "Bulk SEO upload" form on app/internal/brand/[brandId]/seo-bulk — parses and
 * validates the CSV synchronously (fast, no external calls), then hands the heavy lifting (DB
 * inserts + one Slack trigger message per row) to a background function, same fire-and-forget
 * pattern as the other Slack-triggering flows in this app. Plain multipart form POST rather than
 * a server action so this route has `req.url` to build the Netlify function URL from. */
export async function POST(req: Request) {
  const ctx = await getUserContext();
  if (!ctx || !isInternalStaff(ctx)) {
    return new Response("Not authorized", { status: 403 });
  }

  const formData = await req.formData();
  const brandId = formData.get("brandId") as string;
  const file = formData.get("file") as File | null;
  if (!brandId || !file) {
    return redirectWithMessage(req, brandId, "Missing brand or file.");
  }
  if (!(await canStaffAccessBrand(ctx, brandId))) {
    return new Response("Not authorized for this brand", { status: 403 });
  }

  const brandName = await getBrandName(brandId);
  const channelId = await getBrandSlackChannelId(brandId);
  if (!brandName) return redirectWithMessage(req, brandId, "Brand not found.");
  if (!channelId) {
    return redirectWithMessage(req, brandId, "This brand has no Slack channel configured yet — set one before bulk-uploading.");
  }

  const text = await file.text();
  const { rows, skipped } = parseSeoListingBulkCsv(text);

  if (rows.length === 0) {
    return redirectWithMessage(req, brandId, "No valid rows found — check Product Name and Website URL are filled in for every row.");
  }

  const requestedByName = deriveNameFromEmail(ctx.email);
  await fetch(new URL("/.netlify/functions/seo-listing-bulk-background", req.url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brandId, brandName, channelId, requestedByName, rows }),
  });

  const url = new URL(`/internal/brand/${brandId}/seo-bulk`, req.url);
  url.searchParams.set("queued", String(rows.length));
  if (skipped > 0) url.searchParams.set("skipped", String(skipped));
  return Response.redirect(url, 303);
}

function redirectWithMessage(req: Request, brandId: string | null, message: string): Response {
  const url = new URL(`/internal/brand/${brandId ?? ""}/seo-bulk`, req.url);
  url.searchParams.set("error", message);
  return Response.redirect(url, 303);
}
