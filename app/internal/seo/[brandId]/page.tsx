import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserContext, isInternalStaff, canStaffAccessBrand } from "@/lib/user-context";
import { getProductOptimizations, getBrandName, OPTIMIZATION_CATEGORIES } from "@/lib/seo";
import { getDb } from "@/lib/db";
import { Badge } from "@/components/Badge";

async function createOptimization(brandId: string, formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isInternalStaff(ctx)) return;
  if (!(await canStaffAccessBrand(ctx, brandId))) return;

  const title = (formData.get("title") as string)?.trim();
  const category = formData.get("category") as string;
  const description = (formData.get("description") as string)?.trim();
  const priority = formData.get("priority") as string;
  if (!title || !description || !OPTIMIZATION_CATEGORIES.includes(category as any)) return;

  const sql = getDb();
  await sql`
    insert into product_optimizations (brand_id, title, category, description, priority, created_by)
    values (${brandId}, ${title}, ${category}, ${description}, ${priority}, ${ctx.id})
  `;
  revalidatePath(`/internal/seo/${brandId}`);
}

export default async function InternalSeoPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (!isInternalStaff(ctx)) redirect("/dashboard");
  if (!(await canStaffAccessBrand(ctx, brandId))) redirect("/internal");

  const brandName = await getBrandName(brandId);
  if (!brandName) redirect("/internal");

  const optimizations = await getProductOptimizations(brandId);
  const boundCreate = createOptimization.bind(null, brandId);

  return (
    <main>
      <a href="/internal" className="back-link">
        &larr; Back
      </a>
      <h1 style={{ marginBottom: 24 }}>Product optimizations — {brandName}</h1>

      <section className="card" style={{ marginBottom: 24, maxWidth: 640 }}>
        <h2>New product optimization</h2>
        <form action={boundCreate} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label>
            Title
            <br />
            <input name="title" required style={{ width: "100%" }} />
          </label>
          <div style={{ display: "flex", gap: 12 }}>
            <label style={{ flex: 1 }}>
              Category
              <br />
              <select name="category" defaultValue="on_page" style={{ width: "100%" }}>
                {OPTIMIZATION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ flex: 1 }}>
              Priority
              <br />
              <select name="priority" defaultValue="medium" style={{ width: "100%" }}>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </label>
          </div>
          <label>
            Description
            <br />
            <textarea name="description" required rows={3} style={{ width: "100%" }} />
          </label>
          <button type="submit" style={{ alignSelf: "flex-start" }}>
            Add product optimization
          </button>
        </form>
      </section>

      <section>
        <h2>All product optimizations</h2>
        {optimizations.length === 0 ? (
          <p>None yet.</p>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Client comment</th>
                </tr>
              </thead>
              <tbody>
                {optimizations.map((r: any) => (
                  <tr key={r.id}>
                    <td>{r.title}</td>
                    <td>{r.category.replace("_", " ")}</td>
                    <td>
                      <Badge variant={r.priority}>{r.priority}</Badge>
                    </td>
                    <td>
                      <Badge variant={r.status}>{r.status}</Badge>
                    </td>
                    <td>{r.client_comment ?? "—"}</td>
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
