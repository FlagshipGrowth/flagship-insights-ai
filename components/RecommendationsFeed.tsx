import type { ReactNode } from "react";

export interface BrandRecommendationView {
  id: string;
  source: string;
  category: string;
  severity: string | null;
  title: string;
  body: string;
  metaRef: string | null;
  createdAt: string | Date;
}

// Shown to clients now too, so the source is always a plain, generic label — never the name of
// whichever analytics platform actually produced the finding.
const SOURCE_LABELS: Record<string, string> = {
  sellerise: "Amazon Insights",
};

function humanizeCategory(category: string): string {
  return category
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Shared by both app/dashboard/page.tsx and app/internal/brand/[brandId]/page.tsx so the feed
 * looks identical everywhere it appears. `renderActions` is internal-only — omit it (client
 * dashboard) to render a read-only feed with no Mark actioned/Dismiss controls. */
export function RecommendationsFeed({
  recommendations,
  renderActions,
}: {
  recommendations: BrandRecommendationView[];
  renderActions?: (recommendationId: string) => ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {recommendations.map((r) => {
        const sourceLabel = SOURCE_LABELS[r.source] ?? r.source;
        return (
          <div key={r.id} className="agent-post">
            <div className="agent-post-header">
              <div className="agent-avatar">{sourceLabel.charAt(0).toUpperCase()}</div>
              <span className="agent-name">{sourceLabel}</span>
              <span
                className="badge"
                style={{
                  background: r.severity === "high" || r.severity === "critical" ? "var(--accent-lime)" : "var(--paper-2)",
                  color: "var(--ink)",
                }}
              >
                {humanizeCategory(r.category)}
              </span>
              <small style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>{new Date(r.createdAt).toLocaleDateString()}</small>
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
            {renderActions && <div style={{ display: "flex", gap: 8 }}>{renderActions(r.id)}</div>}
          </div>
        );
      })}
    </div>
  );
}
