import { redirect } from "next/navigation";
import { getUserContext, isOwner } from "@/lib/user-context";

export default async function CrmBulkUploadPage({
  searchParams,
}: {
  searchParams: Promise<{ queued?: string; skipped?: string; error?: string }>;
}) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (!isOwner(ctx)) redirect("/internal");

  const { queued, skipped, error } = await searchParams;

  return (
    <main>
      <a href="/internal/crm" className="back-link">
        &larr; Back to CRM
      </a>
      <h1 style={{ marginBottom: 8 }}>Bulk upload leads</h1>
      <p style={{ marginBottom: 24, maxWidth: 640 }}>
        <small>
          For getting a scattered list of warm leads (emails, call notes, spreadsheets) into the CRM at once —
          download the template, fill in one row per lead, and re-upload. Each row becomes its own lead, dropped
          straight into the pipeline at whatever stage you set (defaults to "New").
        </small>
      </p>

      {error && (
        <div className="card" style={{ maxWidth: 640, marginBottom: 20, borderColor: "#DC2626" }}>
          ⚠️ {error}
        </div>
      )}
      {queued && (
        <div className="card" style={{ maxWidth: 640, marginBottom: 20 }}>
          ✅ Queued {queued} lead{queued === "1" ? "" : "s"}.
          {skipped && ` ${skipped} row${skipped === "1" ? "" : "s"} skipped — missing a company name.`}
        </div>
      )}

      <div className="card" style={{ maxWidth: 640 }}>
        <p style={{ marginTop: 0 }}>
          <a href="/api/crm/bulk-template">Download CSV template →</a>
        </p>
        <p>
          <small>
            Columns: <code>Company Name</code> (required), <code>Contact Name</code>, <code>Email</code>,{" "}
            <code>Phone</code>, <code>Source</code>, <code>Estimated Value</code>, <code>Stage</code> (
            <code>new</code>/<code>contacted</code>/<code>qualified</code>/<code>proposal</code>/<code>won</code>/
            <code>lost</code> — defaults to "new" if blank or unrecognized), <code>Notes</code>.
          </small>
        </p>
        <form action="/api/crm/bulk-upload" method="POST" encType="multipart/form-data">
          <input type="file" name="file" accept=".csv" required style={{ display: "block", marginBottom: 12 }} />
          <button type="submit">Upload and queue leads</button>
        </form>
      </div>
    </main>
  );
}
