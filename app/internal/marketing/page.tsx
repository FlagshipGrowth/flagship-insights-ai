import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserContext, isOwner } from "@/lib/user-context";
import {
  getAgencyMarketingMetricsSeries,
  getAgencyMarketingSummary,
  getLastSyncedAt,
  getMarketingRecommendations,
  updateRecommendationStatus,
} from "@/lib/marketing";
import { PERIODS, type Period } from "@/lib/metrics";
import { MetricsChart } from "@/components/MetricsChart";
import { ConfirmButton } from "@/components/ConfirmButton";

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

async function actionRecommendationAction(id: string, status: "actioned" | "dismissed") {
  "use server";
  const ctx = await getUserContext();
  if (!ctx || !isOwner(ctx)) return;
  await updateRecommendationStatus(id, status);
  revalidatePath("/internal/marketing");
}

export default async function MarketingPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/onboarding");
  if (!isOwner(ctx)) redirect("/internal");

  const { period: periodParam } = await searchParams;
  const period = (PERIODS as readonly string[]).includes(periodParam ?? "") ? (periodParam as Period) : "mtd";

  const [series, summary, lastSyncedAt, recommendations] = await Promise.all([
    getAgencyMarketingMetricsSeries(period),
    getAgencyMarketingSummary(period),
    getLastSyncedAt(),
    getMarketingRecommendations(),
  ]);
  const openRecommendations = recommendations.filter((r) => r.status === "open");

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

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 8 }}>
          Ad Manager Recommendations{openRecommendations.length > 0 && ` (${openRecommendations.length})`}
        </h2>
        {openRecommendations.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>
            <small>Nothing open. The Meta Ad Manager agent reviews performance and proposes new creative weekly.</small>
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {openRecommendations.map((r) => {
              const boundAction = actionRecommendationAction.bind(null, r.id, "actioned");
              const boundDismiss = actionRecommendationAction.bind(null, r.id, "dismissed");
              return (
                <div key={r.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.03em",
                          color: r.category === "creative" ? "var(--accent, #2447FF)" : "var(--muted)",
                        }}
                      >
                        {r.category}
                      </span>
                      <div style={{ fontWeight: 700, marginTop: 2 }}>{r.title}</div>
                    </div>
                    <small style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {new Date(r.createdAt).toLocaleDateString()}
                    </small>
                  </div>
                  <p style={{ margin: "8px 0", whiteSpace: "pre-wrap" }}>{r.body}</p>
                  {r.metaRef && (
                    <p style={{ margin: "0 0 8px" }}>
                      <small style={{ color: "var(--muted)" }}>{r.metaRef}</small>
                    </p>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <form action={boundAction}>
                      <button type="submit" className="secondary">
                        Mark actioned
                      </button>
                    </form>
                    <form action={boundDismiss}>
                      <ConfirmButton className="secondary" confirmText="Dismiss this recommendation?">
                        Dismiss
                      </ConfirmButton>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

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
