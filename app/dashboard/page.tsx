import { redirect } from "next/navigation";
import { getUserContext, isInternalStaff } from "@/lib/user-context";
import {
  getBrandsForClient,
  getBrandMetrics,
  getBrandPerformanceTiles,
  getBrandMarketplaceChannels,
  getLatestInsight,
  PERIODS,
  type Period,
} from "@/lib/metrics";
import { getBrandReportLinks, getInventoryPreview, getReconciliationSummary } from "@/lib/reports";
import { PerformanceTiles } from "@/components/PerformanceTiles";
import { InventoryPreviewCard } from "@/components/InventoryPreviewCard";
import { ReconciliationPreviewCard } from "@/components/ReconciliationPreviewCard";
import { PendingApproval } from "@/components/PendingApproval";
import { GenerateInsightButton } from "./GenerateInsightButton";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; period?: string; channel?: string }>;
}) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (isInternalStaff(ctx)) redirect("/internal");
  if (ctx.status === "pending") return <PendingApproval />;
  if (!ctx.clientId) {
    return <main>Your account isn't linked to a client yet — contact Flagship Growth.</main>;
  }

  const brands = await getBrandsForClient(ctx.clientId, ctx.id);
  const { brand: brandParam, period: periodParam, channel: channelParam } = await searchParams;
  const brand = (brands.find((b: any) => b.id === brandParam) ?? brands[0]) as
    | { id: string; name: string; channels_enabled: string[]; has_sellerise: boolean }
    | undefined;
  const period: Period = (PERIODS as string[]).includes(periodParam ?? "") ? (periodParam as Period) : "mtd";

  if (!brand) {
    return <main>No brands are set up on your account yet.</main>;
  }

  // Sellerise is the only Amazon data source trusted for the Performance chart (see
  // lib/metrics.ts's brandHasSellerise) — a brand without it shows "No Amazon connection found"
  // instead of falling back to the older, less reliable weekly-report scrape.
  const hasSellerise = brand.has_sellerise;

  // Marketplace filter: most brands are one marketplace per brand row (switch via sibling brands
  // sharing this client), but a few (Hapad) keep one brand row with several marketplace channels
  // instead (switch via `channel`) — see getBrandMarketplaceChannels. A brand only ever uses one
  // of these two patterns, so only one set of options will actually be non-empty.
  const marketplaceChannels = hasSellerise ? await getBrandMarketplaceChannels(brand.id) : [];
  const channel = marketplaceChannels.some((c) => c.channel === channelParam) ? channelParam : undefined;
  const marketplaceOptions =
    brands.length > 1
      ? brands.map((b: any) => ({ key: b.id, label: b.name, href: `/dashboard?brand=${b.id}&period=${period}`, active: b.id === brand.id }))
      : marketplaceChannels.map((c) => ({
          key: c.channel,
          label: c.label,
          href: `/dashboard?brand=${brand.id}&period=${period}&channel=${c.channel}`,
          active: c.channel === channel,
        }));

  // getBrandMetrics stays as the "does this period have any data at all" gate for the Performance
  // section below — getBrandPerformanceTiles always returns 10 tiles (zeroed when there's no
  // data), so it can't answer that question on its own.
  const metrics = hasSellerise ? await getBrandMetrics(brand.id, period, channel) : [];
  const tiles = hasSellerise ? await getBrandPerformanceTiles(brand.id, period, channel) : [];
  const latestInsight = await getLatestInsight(brand.id);
  const { weeklyReportUrls, inventoryReportUrls, reconciliationReportUrls } = await getBrandReportLinks(brand.id);
  const inventoryPreview = await getInventoryPreview(brand.id);
  const reconciliationSummary = await getReconciliationSummary(brand.id);

  return (
    <main>
      <header style={{ marginBottom: 20 }}>
        <h1>{brand.name}</h1>
      </header>

      <nav className="top-nav">
        <a href={`/dashboard?brand=${brand.id}`} className="active">
          Home
        </a>
        <a href={`/pnl?brand=${brand.id}`}>P&amp;L</a>
        <a href={`/ads?brand=${brand.id}`}>Ads</a>
        <a href={`/marketing?brand=${brand.id}`}>Marketing</a>
        <a href={`/inventory?brand=${brand.id}`}>Inventory</a>
        <a href={`/seo?brand=${brand.id}`}>SEO</a>
        <a href={`/creative?brand=${brand.id}`}>Creative</a>
        <a href={`/account-health?brand=${brand.id}`}>Account health</a>
      </nav>

      {hasSellerise && marketplaceOptions.length > 1 && (
        <nav className="pill-nav" aria-label="Marketplace">
          {marketplaceOptions.map((opt) => (
            <a key={opt.key} href={opt.href} className={opt.active ? "active" : ""}>
              {opt.label}
            </a>
          ))}
        </nav>
      )}

      {hasSellerise && (
        <nav className="pill-nav">
          {PERIODS.map((p) => (
            <a
              key={p}
              href={`/dashboard?brand=${brand.id}&period=${p}${channel ? `&channel=${channel}` : ""}`}
              className={p === period ? "active" : ""}
            >
              {p.toUpperCase()}
            </a>
          ))}
        </nav>
      )}

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
      {!hasSellerise ? (
        <p>No Amazon connection found.</p>
      ) : metrics.length === 0 ? (
        <p>No metrics yet for this period — sync hasn't produced data for this range yet.</p>
      ) : (
        <PerformanceTiles tiles={tiles} />
      )}
    </main>
  );
}
