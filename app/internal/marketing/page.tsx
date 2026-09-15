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

  const syncedRecently = !!lastSyncedAt && Date.now() - new Date(lastSyncedAt).getTime() < 1000 * 60 * 60 * 36;

  return (
    <main style={{ maxWidth: 1120 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h1 style={{ margin: 0 }}>Marketing Efforts</h1>
      </header>
      <p style={{ color: "var(--muted)", marginTop: 0, marginBottom: 24 }}>
        <small>Flagship's own Meta Ads performance (account 1287113856507273) — not client brand data.</small>
      </p>

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ marginBottom: 10 }}>
              Ad Manager{openRecommendations.length > 0 && ` (${openRecommendations.length})`}
            </h2>
            {openRecommendations.length === 0 ? (
              <p style={{ color: "var(--muted)" }}>
                <small>Nothing open. The Meta Ad Manager agent reviews performance and proposes new creative every Monday.</small>
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {openRecommendations.map((r) => {
                  const boundAction = actionRecommendationAction.bind(null, r.id, "actioned");
                  const boundDismiss = actionRecommendationAction.bind(null, r.id, "dismissed");
                  return (
                    <div key={r.id} className="agent-post">
                      <div className="agent-post-header">
                        <div className="agent-avatar">M</div>
                        <span className="agent-name">Meta Ad Manager</span>
                        <span
                          className="badge"
                          style={{
                            background: r.category === "creative" ? "var(--accent-lime)" : "var(--paper-2)",
                            color: "var(--ink)",
                          }}
                        >
                          {r.category}
                        </span>
                        <small style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>
                          {new Date(r.createdAt).toLocaleDateString()}
                        </small>
                      </div>
                      <p className="agent-post-body">
                        <strong>{r.title}</strong>
                        {"\n"}
                        {r.body}
                      </p>
                      {r.metaRef && (
                        <p style={{ margin: "6px 0 10px" }}>
                          <small>{r.metaRef}</small>
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
                    <small>{SUMMARY_LABELS[r.metric_key] ?? r.metric_key}</small>
                    <div style={{ fontSize: "1.3rem", fontWeight: 700, marginTop: 2 }}>
                      {formatSummaryValue(r.metric_key, Number(r.total))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="card">
                <MetricsChart series={series} />
              </div>
            </>
          )}
        </div>

        <aside className="card" style={{ width: 260, flexShrink: 0 }}>
          <h2 style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 14 }}>
            Connections
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 4 }}>
            <strong style={{ fontSize: "0.85rem" }}>Meta Ads</strong>
            <span className="status-chip">
              <span className={`status-dot ${syncedRecently ? "status-ok" : "status-stale"}`} />
              {lastSyncedAt ? `Synced ${new Date(lastSyncedAt).toLocaleString()}` : "Not yet synced"}
            </span>
          </div>
          <p style={{ marginTop: 14, marginBottom: 0 }}>
            <small>Daily sync at 6:23am. Ad Manager reviews performance and proposes new creative every Monday.</small>
          </p>
        </aside>
      </div>
    </main>
  );
}
