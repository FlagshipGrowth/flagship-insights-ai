import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserContext, isInternalStaff } from "@/lib/user-context";
import { getBrandsForClient } from "@/lib/metrics";
import { getProductOptimizations, brandBelongsToClient } from "@/lib/seo";
import { getDb } from "@/lib/db";

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
    return <main style={{ padding: 24 }}>Your account isn't linked to a client yet.</main>;
  }

  const brands = await getBrandsForClient(ctx.clientId);
  const { brand: brandParam } = await searchParams;
  const brand = (brands.find((b: any) => b.id === brandParam) ?? brands[0]) as { id: string; name: string } | undefined;

  if (!brand) {
    return <main style={{ padding: 24 }}>No brands are set up on your account yet.</main>;
  }

  const optimizations = await getProductOptimizations(brand.id);

  return (
    <main style={{ padding: 24 }}>
      <h1>Product optimizations — {brand.name}</h1>
      <p>
        <a href="/dashboard">&larr; Back to dashboard</a>
      </p>

      {optimizations.length === 0 ? (
        <p>Nothing to review yet.</p>
      ) : (
        optimizations.map((r: any) => (
          <section
            key={r.id}
            style={{ border: "1px solid var(--muted)", padding: 16, marginBottom: 16, maxWidth: 640 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>{r.title}</strong>
              <span>
                {r.category.replace("_", " ")} · {r.priority} priority · {r.status}
              </span>
            </div>
            <p>{r.description}</p>
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
                <button type="submit" name="status" value="rejected">
                  Reject
                </button>
              </form>
            ) : (
              <small>
                {r.status} {r.reviewed_at ? `on ${new Date(r.reviewed_at).toLocaleDateString()}` : ""}
                {r.client_comment ? ` — "${r.client_comment}"` : ""}
              </small>
            )}
          </section>
        ))
      )}
    </main>
  );
}
