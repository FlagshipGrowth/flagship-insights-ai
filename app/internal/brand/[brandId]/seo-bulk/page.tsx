import { redirect } from "next/navigation";
import { getUserContext, isInternalStaff, canStaffAccessBrand } from "@/lib/user-context";
import { getBrandName } from "@/lib/seo";
import { getBrandSlackChannelId } from "@/lib/brands";

export default async function SeoBulkUploadPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>;
  searchParams: Promise<{ queued?: string; skipped?: string; error?: string }>;
}) {
  const { brandId } = await params;
  const { queued, skipped, error } = await searchParams;
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (!isInternalStaff(ctx)) redirect("/dashboard");
  if (!(await canStaffAccessBrand(ctx, brandId))) redirect("/internal");

  const brandName = await getBrandName(brandId);
  if (!brandName) redirect("/internal");
  const channelId = await getBrandSlackChannelId(brandId);

  return (
    <main>
      <a href={`/internal/brand/${brandId}`} className="back-link">
        &larr; Back to {brandName}
      </a>
      <h1 style={{ marginBottom: 8 }}>Bulk SEO listing upload — {brandName}</h1>
      <p style={{ marginBottom: 24, maxWidth: 640 }}>
        <small>
          For running the SEO listing agent across many SKUs at once (e.g. a new catalog launch). Download the
          template, fill in one row per product, and re-upload — each row becomes its own tracked task, and Claude
          Tag researches and drafts each one individually in the brand's Slack channel, same as a single{" "}
          <code>/seo-listing</code> request. Once a task's thread shows complete, review the actual draft in the
          brand's <code>SEO-{brandName}</code> Google Sheet — that's the reviewable record, not the Slack thread.
        </small>
      </p>

      {error && (
        <div className="card" style={{ maxWidth: 640, marginBottom: 20, borderColor: "var(--danger, #c0392b)" }}>
          ⚠️ {error}
        </div>
      )}
      {queued && (
        <div className="card" style={{ maxWidth: 640, marginBottom: 20 }}>
          ✅ Queued {queued} SEO listing task{queued === "1" ? "" : "s"}.
          {skipped && ` ${skipped} row${skipped === "1" ? "" : "s"} skipped — missing Product Name or a valid Website URL.`}{" "}
          Watch the brand's Slack channel for progress, and the sheet for drafts as they land.
        </div>
      )}

      {!channelId ? (
        <div className="card" style={{ maxWidth: 640 }}>
          This brand has no Slack channel configured yet — set one on the{" "}
          <a href={`/internal/brand/${brandId}`}>brand page</a> before bulk-uploading (Claude Tag needs a channel to
          post the trigger messages into).
        </div>
      ) : (
        <div className="card" style={{ maxWidth: 640 }}>
          <p style={{ marginTop: 0 }}>
            <a href="/api/seo-listing/bulk-template">Download CSV template →</a>
          </p>
          <p>
            <small>
              Columns: <code>Product Name</code> (required), <code>SKU</code> (optional), <code>Website URL</code>{" "}
              (required — the actual product page), <code>Priority</code> (optional — <code>low</code>,{" "}
              <code>med</code>, or <code>high</code>).
            </small>
          </p>
          <form action="/api/seo-listing/bulk-upload" method="POST" encType="multipart/form-data">
            <input type="hidden" name="brandId" value={brandId} />
            <input type="file" name="file" accept=".csv" required style={{ display: "block", marginBottom: 12 }} />
            <button type="submit">Upload and queue tasks</button>
          </form>
        </div>
      )}
    </main>
  );
}
