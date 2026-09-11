import { redirect } from "next/navigation";
import { getUserContext, isInternalStaff, canStaffAccessBrand } from "@/lib/user-context";
import { getBrandName } from "@/lib/seo";

// Shared shell for tools that need real Amazon data we don't have yet (Phase 1 pending) —
// keeps the access-check + "not connected" messaging consistent across Forecast,
// Reimbursements, Reviews, etc. rather than triplicating it.
export async function PendingToolPage({
  brandId,
  title,
  description,
}: {
  brandId: string;
  title: string;
  description: string;
}) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (!isInternalStaff(ctx)) redirect("/dashboard");
  if (!(await canStaffAccessBrand(ctx, brandId))) redirect("/internal");

  const brandName = await getBrandName(brandId);
  if (!brandName) redirect("/internal");

  return (
    <main>
      <a href={`/internal/brand/${brandId}`} className="back-link">
        &larr; {brandName}
      </a>
      <h1 style={{ marginBottom: 24 }}>{title}</h1>
      <div className="card" style={{ maxWidth: 640 }}>
        <p>{description}</p>
      </div>
    </main>
  );
}
