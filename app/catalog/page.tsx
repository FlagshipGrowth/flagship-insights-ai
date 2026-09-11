import { redirect } from "next/navigation";
import { getUserContext, isInternalStaff } from "@/lib/user-context";
import { getBrandsForClient } from "@/lib/metrics";
import { getProductsForBrand } from "@/lib/catalog";
import { Badge } from "@/components/Badge";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
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

  const products = await getProductsForBrand(brand.id);
  const lastSyncedAt = products.reduce(
    (latest: string | null, p: any) => (p.last_synced_at && (!latest || p.last_synced_at > latest) ? p.last_synced_at : latest),
    null
  );

  return (
    <main>
      <a href="/dashboard" className="back-link">
        &larr; Back to dashboard
      </a>
      <h1 style={{ marginBottom: 4 }}>Catalog — {brand.name}</h1>
      <p style={{ marginBottom: 24 }}>
        <small>
          {lastSyncedAt
            ? `Last updated ${new Date(lastSyncedAt).toLocaleString()}.`
            : "Not synced yet."}
        </small>
      </p>

      {products.length === 0 ? (
        <p>No products synced yet.</p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table>
            <thead>
              <tr>
                <th>ASIN</th>
                <th>Title</th>
                <th>Status</th>
                <th>Category</th>
                <th>UPC</th>
                <th>Cost</th>
                <th>MSRP</th>
                <th>Weight</th>
                <th>Case dims (L×W×H)</th>
                <th>Case qty</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p: any) => (
                <tr key={p.asin}>
                  <td>{p.asin}</td>
                  <td>{p.title ?? "—"}</td>
                  <td>{p.status ? <Badge variant={p.status}>{p.status}</Badge> : "—"}</td>
                  <td>{p.category ?? p.sub_category ?? p.product_type ?? "—"}</td>
                  <td>{p.upc ?? "—"}</td>
                  <td>{p.cost_landed != null ? `$${Number(p.cost_landed).toFixed(2)}` : "—"}</td>
                  <td>{p.msrp != null ? `$${Number(p.msrp).toFixed(2)}` : "—"}</td>
                  <td>{p.unit_weight ?? "—"}</td>
                  <td>
                    {p.case_length != null && p.case_width != null && p.case_height != null
                      ? `${p.case_length}×${p.case_width}×${p.case_height}`
                      : "—"}
                  </td>
                  <td>{p.case_qty ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
