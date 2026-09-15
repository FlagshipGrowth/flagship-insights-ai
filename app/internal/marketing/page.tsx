import { redirect } from "next/navigation";
import { getUserContext, isOwner } from "@/lib/user-context";
import { getAgencyMarketingMetricsSeries, getAgencyMarketingSummary, getLastSyncedAt } from "@/lib/marketing";
import { PERIODS, type Period } from "@/lib/metrics";
import { MetricsChart } from "@/components/MetricsChart";

const SUMMARY_LABELS: Record<string, string> = {
  amount_spent: "Spend",
  impressions: "Impressions",
  clicks: "Clicks",
  reach: "Reach",
  link_click: "Link Clicks",
  lead: "Leads",
};

function formatSummaryValue(metricKey: string, value: number): string {
  if (metricKey === "amount_spent") return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return value.toLocaleString();
}

export default async function MarketingPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (!isOwner(ctx)) redirect("/internal");

  const { period: periodParam } = await searchParams;
  const period = (PERIODS as readonly string[]).includes(periodParam ?? "") ? (periodParam as Period) : "mtd";

  const [series, summary, lastSyncedAt] = await Promise.all([
    getAgencyMarketingMetricsSeries(period),
    getAgencyMarketingSummary(period),
    getLastSyncedAt(),
  ]);

  return (
    <main>
      <a href="/internal" className="back-link">
        &larr; Back
      </a>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>Marketing Efforts</h1>
      </header>
      <p style={{ color: "var(--muted)", marginTop: 0, marginBottom: 16 }}>
        <small>
          Flagship's own Meta Ads performance (account 1287113856507273) — not client brand data.
          {lastSyncedAt ? ` Last synced ${new Date(lastSyncedAt).toLocaleString()}.` : " Not yet synced."}
        </small>
      </p>

      <nav className="pill-nav" style={{ marginBottom: 16 }}>
        {PERIODS.map((p) => (
          <a key={p} href={`?period=${p}`} className={p === period ? "active" : ""}>
            {p.toUpperCase()}
          </a>
        ))}
      </nav>

      {summary.length === 0 ? (
        <p>No Meta Ads data synced yet.</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
            {summary.map((r: any) => (
              <div key={`${r.channel}-${r.metric_key}`} className="card" style={{ minWidth: 130 }}>
                <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>
                  {formatSummaryValue(r.metric_key, Number(r.total))}
                </div>
                <small style={{ color: "var(--muted)" }}>{SUMMARY_LABELS[r.metric_key] ?? r.metric_key}</small>
              </div>
            ))}
          </div>

          <div className="card">
            <MetricsChart series={series} />
          </div>
        </>
      )}
    </main>
  );
}
