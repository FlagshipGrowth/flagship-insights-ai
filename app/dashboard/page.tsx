import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { getUserContext, isInternalStaff } from "@/lib/user-context";
import { getBrandsForClient, getBrandMetrics, getBrandMetricsTimeSeries, getLatestInsight, PERIODS, type Period } from "@/lib/metrics";
import { getBrandReportLinks, getInventoryPreview, getReconciliationSummary } from "@/lib/reports";
import { MetricsChart } from "@/components/MetricsChart";
import { InventoryPreviewCard } from "@/components/InventoryPreviewCard";
import { ReconciliationPreviewCard } from "@/components/ReconciliationPreviewCard";
import { GenerateInsightButton } from "./GenerateInsightButton";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; period?: string }>;
}) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (isInternalStaff(ctx)) redirect("/internal");
  if (!ctx.clientId) {
    return <main>Your account isn't linked to a client yet — contact Flagship Growth.</main>;
  }

  const brands = await getBrandsForClient(ctx.clientId);
  const { brand: brandParam, period: periodParam } = await searchParams;
  const brand = (brands.find((b: any) => b.id === brandParam) ?? brands[0]) as
    | { id: string; name: string; channels_enabled: string[] }
    | undefined;
  const period: Period = (PERIODS as string[]).includes(periodParam ?? "") ? (periodParam as Period) : "mtd";

  if (!brand) {
    return <main>No brands are set up on your account yet.</main>;
  }

  const metrics = await getBrandMetrics(brand.id, period);
  const metricsSeries = await getBrandMetricsTimeSeries(brand.id, period);
  const latestInsight = await getLatestInsight(brand.id);
  const { weeklyReportUrls, inventoryReportUrls, reconciliationReportUrls } = await getBrandReportLinks(brand.id);
  const inventoryPreview = await getInventoryPreview(brand.id);
  const reconciliationSummary = await getReconciliationSummary(brand.id);

  return (
    <main>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1>{brand.name}</h1>
        <UserButton />
      </header>

      <nav className="top-nav">
        <a href="/organization">Team</a>
        <a href="/connections">Connections</a>
        <a href={`/inventory?brand=${brand.id}`}>Inventory</a>
        <a href={`/catalog?brand=${brand.id}`}>Catalog</a>
        <a href={`/seo?brand=${brand.id}`}>SEO</a>
      </nav>

      <nav className="pill-nav">
        {PERIODS.map((p) => (
          <a key={p} href={`/dashboard?brand=${brand.id}&period=${p}`} className={p === period ? "active" : ""}>
            {p.toUpperCase()}
          </a>
        ))}
      </nav>

      {(weeklyReportUrls.length > 0 || inventoryReportUrls.length > 0 || reconciliationReportUrls.length > 0) && (
        <section className="card" style={{ marginBottom: 24, maxWidth: 720 }}>
          <h2>Reports</h2>
          <p>
            <small>Updated weekly, usually Monday or Tuesday.</small>
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {weeklyReportUrls.map((r) => (
              <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer">
                Weekly Sales/Ads Report{r.label ? ` (${r.label})` : ""} →
              </a>
            ))}
            {inventoryReportUrls.map((r) => (
              <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer">
                Inventory Report{r.label ? ` (${r.label})` : ""} →
              </a>
            ))}
            {reconciliationReportUrls.map((r) => (
              <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer">
                Reconciliation Report{r.label ? ` (${r.label})` : ""} →
              </a>
            ))}
          </div>
        </section>
      )}

      {inventoryPreview && (
        <InventoryPreviewCard preview={inventoryPreview} reportUrl={inventoryReportUrls[0]?.url} />
      )}

      {reconciliationSummary && (
        <ReconciliationPreviewCard summary={reconciliationSummary} reportUrl={reconciliationReportUrls[0]?.url} />
      )}

      <section className="card" style={{ marginBottom: 24, maxWidth: 720 }}>
        <h2>Latest recommendation</h2>
        {latestInsight ? (
          <>
            <p>{latestInsight.summary}</p>
            <small>Generated {new Date(latestInsight.created_at).toLocaleString()}</small>
          </>
        ) : (
          <p>No recommendation generated yet.</p>
        )}
        <div style={{ marginTop: 8 }}>
          <GenerateInsightButton brandId={brand.id} />
        </div>
      </section>

      <h2>Performance</h2>
      {metrics.length === 0 ? (
        <p>
          No metrics yet for this period —{" "}
          {brand.channels_enabled.length === 0
            ? "no channels connected yet."
            : "sync hasn't produced data for this range yet."}
        </p>
      ) : (
        <div className="card" style={{ maxWidth: 720 }}>
          <MetricsChart series={metricsSeries as any} />
        </div>
      )}
    </main>
  );
}
