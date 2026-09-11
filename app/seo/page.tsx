import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserContext, isInternalStaff } from "@/lib/user-context";
import { getBrandsForClient } from "@/lib/metrics";
import { getProductOptimizations, brandBelongsToClient } from "@/lib/seo";
import { getDb } from "@/lib/db";
import { Badge } from "@/components/Badge";

async function reviewOptimization(formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !ctx.clientId) return;

  const optimizationId = formData.get("optimizationId") as string;
  const brandId = formData.get("brandId") as string;
  const status = formData.get("status") as string;
  const comment = (formData.get("comment") as string)?.trim() || null;
  if (!["approved", "rejected"].includes(status)) return;
  if (!(await brandBelongsToClient(brandId, ctx.clientId))) return;

  const sql = getDb();
  await sql`
    update product_optimizations
    set status = ${status}, client_comment = ${comment}, reviewed_by = ${ctx.id}, reviewed_at = now()
    where id = ${optimizationId} and brand_id = ${brandId}
  `;
  revalidatePath("/seo");
}

export default async function SeoPage({ searchParams }: { searchParams: Promise<{ brand?: string }> }) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (isInternalStaff(ctx)) redirect("/internal");
  if (!ctx.clientId) {
    return <main>Your account isn't linked to a client yet.</main>;
  }

  const brands = await getBrandsForClient(ctx.clientId);
  const { brand: brandParam } = await searchParams;
  const brand = (brands.find((b: any) => b.id === brandParam) ?? brands[0]) as { id: string; name: string } | undefined;

  if (!brand) {
    return <main>No brands are set up on your account yet.</main>;
  }

  const optimizations = await getProductOptimizations(brand.id);

  return (
    <main>
      <a href="/dashboard" className="back-link">
        &larr; Back to dashboard
      </a>
      <h1 style={{ marginBottom: 24 }}>Product optimizations — {brand.name}</h1>

      {optimizations.length === 0 ? (
        <p>Nothing to review yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
          {optimizations.map((r: any) => (
            <section key={r.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
                <strong>{r.title}</strong>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <Badge variant={r.priority}>{r.priority}</Badge>
                  <Badge variant={r.status}>{r.status}</Badge>
                </div>
              </div>
              <p style={{ color: "var(--muted)" }}>
                {r.category.replace("_", " ")} · {r.description}
              </p>
              {r.status === "pending" ? (
                <form action={reviewOptimization} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <input type="hidden" name="optimizationId" value={r.id} />
                  <input type="hidden" name="brandId" value={brand.id} />
                  <label style={{ flex: 1 }}>
                    Comment (optional)
                    <br />
                    <input name="comment" style={{ width: "100%" }} />
                  </label>
                  <button type="submit" name="status" value="approved">
                    Approve
                  </button>
                  <button type="submit" name="status" value="rejected" className="secondary">
                    Reject
                  </button>
                </form>
              ) : (
                <small>
                  {r.reviewed_at ? `Reviewed ${new Date(r.reviewed_at).toLocaleDateString()}` : ""}
                  {r.client_comment ? ` — "${r.client_comment}"` : ""}
                </small>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
