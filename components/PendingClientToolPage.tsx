import { redirect } from "next/navigation";
import { getUserContext, isInternalStaff } from "@/lib/user-context";
import { getBrandsForClient } from "@/lib/metrics";
import { PendingApproval } from "@/components/PendingApproval";

// Client-facing counterpart to components/PendingToolPage.tsx (which is internal-only and
// path-scoped) — same "coming soon" shell, but for the top-level, query-param-scoped client
// dashboard tabs (P&L, Ads, Marketing, Creative, Account health).
export async function PendingClientToolPage({
  brand: brandParam,
  title,
  description,
}: {
  brand?: string;
  title: string;
  description: string;
}) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (isInternalStaff(ctx)) redirect("/internal");
  if (ctx.status === "pending") return <PendingApproval />;
  if (!ctx.clientId) {
    return <main>Your account isn't linked to a client yet — contact Flagship Growth.</main>;
  }

  const brands = await getBrandsForClient(ctx.clientId, ctx.id);
  const brand = (brands.find((b: any) => b.id === brandParam) ?? brands[0]) as { id: string; name: string } | undefined;
  if (!brand) {
    return <main>No brands are set up on your account yet.</main>;
  }

  return (
    <main>
      <a href={`/dashboard?brand=${brand.id}`} className="back-link">
        &larr; {brand.name}
      </a>
      <h1 style={{ marginBottom: 24 }}>{title}</h1>
      <div className="card" style={{ maxWidth: 640 }}>
        <p>{description}</p>
      </div>
    </main>
  );
}
