import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserContext, isInternalStaff } from "@/lib/user-context";
import { getBrandsForClient } from "@/lib/metrics";
import { brandBelongsToClient } from "@/lib/seo";
import { getProductsForBrand, addProduct, type NewProductInput } from "@/lib/catalog";
import { Badge } from "@/components/Badge";

async function addProductAction(brandId: string, formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !ctx.clientId) return;
  if (!(await brandBelongsToClient(brandId, ctx.clientId))) return;

  const text = (name: string) => (formData.get(name) as string)?.trim() || null;
  const num = (name: string) => {
    const v = formData.get(name) as string;
    return v?.trim() ? Number(v) : null;
  };
  const status = formData.get("status") as string;

  const input: NewProductInput = {
    sku: text("sku"),
    title: text("title"),
    status: status === "active" || status === "discontinued" ? status : null,
    category: text("category"),
    subCategory: text("subCategory"),
    productType: text("productType"),
    upc: text("upc"),
    costLanded: num("costLanded"),
    msrp: num("msrp"),
    unitWeight: num("unitWeight"),
    caseQty: num("caseQty"),
    caseWeight: num("caseWeight"),
    caseLength: num("caseLength"),
    caseWidth: num("caseWidth"),
    caseHeight: num("caseHeight"),
  };
  if (!input.title) return;

  await addProduct(brandId, input);
  revalidatePath("/catalog");
}

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
  const boundAddProduct = addProductAction.bind(null, brand.id);

  return (
    <main>
      <a href="/dashboard" className="back-link">
        &larr; Back to dashboard
      </a>
      <h1 style={{ marginBottom: 4 }}>Catalog — {brand.name}</h1>
      <p style={{ marginBottom: 24 }}>
        <small>{lastSyncedAt ? `Last updated ${new Date(lastSyncedAt).toLocaleString()}.` : "Not synced yet."}</small>
      </p>

      <details className="card" style={{ marginBottom: 24, maxWidth: 720 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>+ Add product</summary>
        <form
          action={boundAddProduct}
          style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <label>
            Title
            <br />
            <input name="title" required style={{ width: "100%" }} />
          </label>
          <label>
            SKU
            <br />
            <input name="sku" style={{ width: "100%" }} />
          </label>
          <label>
            Status
            <br />
            <select name="status" defaultValue="active" style={{ width: "100%" }}>
              <option value="active">Active</option>
              <option value="discontinued">Discontinued</option>
            </select>
          </label>
          <label>
            UPC
            <br />
            <input name="upc" style={{ width: "100%" }} />
          </label>
          <label>
            Category
            <br />
            <input name="category" style={{ width: "100%" }} />
          </label>
          <label>
            Sub category
            <br />
            <input name="subCategory" style={{ width: "100%" }} />
          </label>
          <label>
            Product type
            <br />
            <input name="productType" style={{ width: "100%" }} />
          </label>
          <label>
            Cost (landed)
            <br />
            <input name="costLanded" type="number" min="0" step="0.01" style={{ width: "100%" }} />
          </label>
          <label>
            MSRP
            <br />
            <input name="msrp" type="number" min="0" step="0.01" style={{ width: "100%" }} />
          </label>
          <label>
            Unit weight
            <br />
            <input name="unitWeight" type="number" min="0" step="0.01" style={{ width: "100%" }} />
          </label>
          <label>
            Case qty
            <br />
            <input name="caseQty" type="number" min="0" step="1" style={{ width: "100%" }} />
          </label>
          <label>
            Case weight
            <br />
            <input name="caseWeight" type="number" min="0" step="0.01" style={{ width: "100%" }} />
          </label>
          <label>
            Case length
            <br />
            <input name="caseLength" type="number" min="0" step="0.01" style={{ width: "100%" }} />
          </label>
          <label>
            Case width
            <br />
            <input name="caseWidth" type="number" min="0" step="0.01" style={{ width: "100%" }} />
          </label>
          <label>
            Case height
            <br />
            <input name="caseHeight" type="number" min="0" step="0.01" style={{ width: "100%" }} />
          </label>
          <div style={{ gridColumn: "1 / -1" }}>
            <button type="submit">Add product</button>
          </div>
        </form>
      </details>

      {products.length === 0 ? (
        <p>No products synced yet.</p>
      ) : (
        <div className="card table-scroll" style={{ padding: 0 }}>
          <table className="table-dense">
            <thead>
              <tr>
                <th>SKU</th>
                <th>ASIN</th>
                <th>Title</th>
                <th>Status</th>
                <th>Category</th>
                <th>UPC</th>
                <th>Cost</th>
                <th>MSRP</th>
                <th>Weight</th>
                <th>Case L×W×H</th>
                <th>Case qty</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p: any) => (
                <tr key={p.id}>
                  <td>{p.sku ?? "—"}</td>
                  <td>{p.asin ?? "—"}</td>
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
