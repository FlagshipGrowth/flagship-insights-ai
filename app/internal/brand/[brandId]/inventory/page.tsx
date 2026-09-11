import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserContext, isInternalStaff, canStaffAccessBrand } from "@/lib/user-context";
import { getBrandName } from "@/lib/seo";
import { getDb } from "@/lib/db";

async function addManualInventory(brandId: string, formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isInternalStaff(ctx)) return;
  if (!(await canStaffAccessBrand(ctx, brandId))) return;

  const sku = (formData.get("sku") as string)?.trim();
  const quantity = Number(formData.get("quantity"));
  if (!sku || !Number.isFinite(quantity)) return;

  const sql = getDb();
  await sql`
    insert into inventory_snapshot (brand_id, sku, source, quantity, as_of_date)
    values (${brandId}, ${sku}, 'manual', ${quantity}, current_date)
  `;
  revalidatePath(`/internal/brand/${brandId}/inventory`);
}

export default async function InternalInventoryPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (!isInternalStaff(ctx)) redirect("/dashboard");
  if (!(await canStaffAccessBrand(ctx, brandId))) redirect("/internal");

  const brandName = await getBrandName(brandId);
  if (!brandName) redirect("/internal");

  const sql = getDb();
  const snapshots = await sql`
    select sku, source, quantity, as_of_date from inventory_snapshot
    where brand_id = ${brandId}
    order by as_of_date desc, sku
    limit 50
  `;
  const boundAdd = addManualInventory.bind(null, brandId);

  return (
    <main>
      <a href={`/internal/brand/${brandId}`} className="back-link">
        &larr; {brandName}
      </a>
      <h1 style={{ marginBottom: 24 }}>Inventory — {brandName}</h1>

      <section className="card" style={{ marginBottom: 24, maxWidth: 640 }}>
        <h2>Log manual inventory</h2>
        <p>
          <small>
            Amazon/Walmart/3PL inventory will sync automatically once those connections are live — this covers
            stock not yet reflected anywhere else.
          </small>
        </p>
        <form action={boundAdd} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <label>
            SKU
            <br />
            <input name="sku" required />
          </label>
          <label>
            Quantity
            <br />
            <input name="quantity" type="number" min="0" required />
          </label>
          <button type="submit">Add</button>
        </form>
      </section>

      <section>
        <h2>Recent snapshots</h2>
        {snapshots.length === 0 ? (
          <p>No inventory recorded yet.</p>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden", maxWidth: 640 }}>
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Source</th>
                  <th>Quantity</th>
                  <th>As of</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s: any, i: number) => (
                  <tr key={i}>
                    <td>{s.sku}</td>
                    <td>{s.source}</td>
                    <td>{s.quantity}</td>
                    <td>{new Date(s.as_of_date).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
