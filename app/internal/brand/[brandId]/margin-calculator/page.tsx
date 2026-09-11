import { redirect } from "next/navigation";
import { getUserContext, isInternalStaff, canStaffAccessBrand } from "@/lib/user-context";
import { getBrandName } from "@/lib/seo";
import { getProductsForBrand } from "@/lib/catalog";
import { MarginCalculator } from "./MarginCalculator";

export default async function MarginCalculatorPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (!isInternalStaff(ctx)) redirect("/dashboard");
  if (!(await canStaffAccessBrand(ctx, brandId))) redirect("/internal");

  const brandName = await getBrandName(brandId);
  if (!brandName) redirect("/internal");

  const rows = await getProductsForBrand(brandId);
  const products = rows.map((p: any) => ({
    id: p.id as string,
    sku: p.sku as string | null,
    asin: p.asin as string | null,
    title: p.title as string | null,
    costLanded: p.cost_landed != null ? Number(p.cost_landed) : null,
    msrp: p.msrp != null ? Number(p.msrp) : null,
  }));

  return (
    <main>
      <a href={`/internal/brand/${brandId}`} className="back-link">
        &larr; {brandName}
      </a>
      <h1 style={{ marginBottom: 24 }}>Item-level margin calculator — {brandName}</h1>
      <MarginCalculator products={products} />
    </main>
  );
}
