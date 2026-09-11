import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserContext, isInternalStaff } from "@/lib/user-context";
import { getBrandsForClient } from "@/lib/metrics";
import { getDb } from "@/lib/db";

// The only inventory source that isn't blocked on a platform approval (SPEC.md §6) —
// Amazon/Walmart/3PL inventory all wait on the same approvals as their metrics sync.
async function addManualInventory(formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !ctx.clientId) return;

  const brandId = formData.get("brandId") as string;
  const sku = (formData.get("sku") as string)?.trim();
  const quantity = Number(formData.get("quantity"));
  if (!brandId || !sku || !Number.isFinite(quantity)) return;

  const sql = getDb();
  // Verify the brand actually belongs to this user's client before writing — brandId comes
  // from form data, which a client could tamper with to target another brand.
  const owned = await sql`select 1 from brands where id = ${brandId} and client_id = ${ctx.clientId}`;
  if (owned.length === 0) return;

  await sql`
    insert into inventory_snapshot (brand_id, sku, source, quantity, as_of_date)
    values (${brandId}, ${sku}, 'manual', ${quantity}, current_date)
  `;
  revalidatePath("/inventory");
}

export default async function InventoryPage({
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

  const sql = getDb();
  const snapshots = await sql`
    select sku, source, quantity, as_of_date from inventory_snapshot
    where brand_id = ${brand.id}
    order by as_of_date desc, sku
    limit 50
  `;

  return (
    <main>
      <a href="/dashboard" className="back-link">
        &larr; Back to dashboard
      </a>
      <h1 style={{ marginBottom: 24 }}>Inventory — {brand.name}</h1>

      <section className="card" style={{ marginBottom: 24, maxWidth: 640 }}>
        <h2>Log manual inventory</h2>
        <p>
          <small>
            For stock not yet reflected anywhere else (in production, in transit). Amazon/Walmart/3PL
            inventory will sync automatically once those connections are live.
          </small>
        </p>
        <form action={addManualInventory} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <input type="hidden" name="brandId" value={brand.id} />
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
