import type { PerformanceTile, TileKey } from "@/lib/metrics";

const TILE_LABELS: Record<TileKey, string> = {
  revenue: "Revenue",
  units: "Units",
  organic_sales: "Organic Sales",
  ppc_spend: "PPC Spend",
  ppc_sales: "PPC Sales",
  refund_rate: "Refund Rate",
  acos: "ACOS",
  tacos: "TACOS",
  roas: "ROAS",
  cpc: "CPC",
};

const CURRENCY_TILES = new Set<TileKey>(["revenue", "organic_sales", "ppc_spend", "ppc_sales", "cpc"]);
const PERCENT_TILES = new Set<TileKey>(["refund_rate", "acos", "tacos"]);

function formatTileValue(key: TileKey, value: number): string {
  if (CURRENCY_TILES.has(key)) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (PERCENT_TILES.has(key)) return `${value.toFixed(1)}%`;
  if (key === "roas") return `${value.toFixed(2)}x`;
  return value.toLocaleString();
}

// A minimal inline trend line — no axis, no legend, no hover — deliberately not the full
// MetricsChart, since rendering 10 of those at once would be heavy and visually noisy.
function Sparkline({ points }: { points: { date: string; value: number }[] }) {
  const w = 100;
  const h = 36;
  if (points.length < 2) {
    return <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" />;
  }
  const values = points.map((p) => p.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || 1;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p.value - min) / range) * h;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  const last = points[points.length - 1];
  const lastY = h - ((last.value - min) / range) * h;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={path} fill="none" stroke="#2447FF" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <circle cx={w} cy={lastY} r={2} fill="#2447FF" />
    </svg>
  );
}

export function PerformanceTiles({ tiles }: { tiles: PerformanceTile[] }) {
  return (
    <div className="performance-tiles" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
      {tiles.map((t) => {
        const up = t.wowChangePct !== null && t.wowChangePct >= 0;
        return (
          <div key={t.key} className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: 4 }}>{TILE_LABELS[t.key]}</div>
            <div style={{ fontSize: "1.35rem", fontWeight: 700, marginBottom: 4 }}>{formatTileValue(t.key, t.value)}</div>
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: t.wowChangePct === null ? "var(--muted)" : up ? "#059669" : "#DC2626",
                marginBottom: 8,
              }}
            >
              {t.wowChangePct === null ? "N/A" : `${up ? "▲" : "▼"} ${Math.abs(t.wowChangePct).toFixed(1)}%`}
            </div>
            <Sparkline points={t.sparkline} />
          </div>
        );
      })}
      <style>{`
        @media (max-width: 900px) {
          .performance-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 520px) {
          .performance-tiles { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
