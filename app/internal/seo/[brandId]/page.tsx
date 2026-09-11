import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserContext, isInternalStaff, canStaffAccessBrand } from "@/lib/user-context";
import { getSeoRecommendations, getBrandName, SEO_CATEGORIES } from "@/lib/seo";
import { getDb } from "@/lib/db";

async function createRecommendation(brandId: string, formData: FormData) {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isInternalStaff(ctx)) return;
  if (!(await canStaffAccessBrand(ctx, brandId))) return;

  const title = (formData.get("title") as string)?.trim();
  const category = formData.get("category") as string;
  const description = (formData.get("description") as string)?.trim();
  const priority = formData.get("priority") as string;
  if (!title || !description || !SEO_CATEGORIES.includes(category as any)) return;

  const sql = getDb();
  await sql`
    insert into seo_recommendations (brand_id, title, category, description, priority, created_by)
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

  const recommendations = await getSeoRecommendations(brandId);
  const boundCreate = createRecommendation.bind(null, brandId);

  return (
    <main style={{ padding: 24 }}>
      <h1>SEO — {brandName}</h1>
      <p>
        <a href="/internal">&larr; Back</a>
      </p>

      <section style={{ marginBottom: 24, maxWidth: 640 }}>
        <h2>New recommendation</h2>
        <form action={boundCreate} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label>
            Title
            <br />
            <input name="title" required style={{ width: "100%" }} />
          </label>
          <label>
            Category
            <br />
            <select name="category" defaultValue="on_page">
              {SEO_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <br />
            <select name="priority" defaultValue="medium">
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </label>
          <label>
            Description
            <br />
            <textarea name="description" required rows={3} style={{ width: "100%" }} />
          </label>
          <button type="submit" style={{ alignSelf: "flex-start" }}>
            Add recommendation
          </button>
        </form>
      </section>

      <section>
        <h2>All recommendations</h2>
        {recommendations.length === 0 ? (
          <p>None yet.</p>
        ) : (
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
              {recommendations.map((r: any) => (
                <tr key={r.id}>
                  <td>{r.title}</td>
                  <td>{r.category}</td>
                  <td>{r.priority}</td>
                  <td>{r.status}</td>
                  <td>{r.client_comment ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
