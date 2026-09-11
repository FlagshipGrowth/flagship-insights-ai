import { redirect } from "next/navigation";
import { getUserContext, isInternalStaff, canStaffAccessBrand } from "@/lib/user-context";
import { getBrandName } from "@/lib/seo";
import { MarginCalculator } from "./MarginCalculator";

export default async function MarginCalculatorPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
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
      <h1 style={{ marginBottom: 24 }}>Item-level margin calculator</h1>
      <MarginCalculator />
    </main>
  );
}
