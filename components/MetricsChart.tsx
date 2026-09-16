"use client";

import { useMemo, useRef, useState } from "react";

export interface MetricPoint {
  date: string;
  channel: string;
  metric_key: string;
  value: number;
}

const METRIC_LABELS: Record<string, string> = {
  sales: "Sales",
  ad_spend: "Ad Spend",
  ppc_revenue: "PPC Revenue",
  organic_revenue: "Organic Revenue",
  units_sold: "Units Sold",
  roas: "ROAS",
  tacos: "TACoS",
  ctr: "CTR",
  cvr: "CVR",
  amount_spent: "Spend",
  impressions: "Impressions",
  clicks: "Clicks",
  reach: "Reach",
  link_click: "Link Clicks",
  lead: "Leads",
  cost_per_lead: "Cost per Lead",
  gmv: "GMV",
  affiliate_gmv: "Affiliate GMV",
  video_gmv: "Video GMV",
  live_gmv: "Live GMV",
  shop_health_score: "Shop Health Score",
  active_creators: "Active Creators",
  revenue: "Revenue",
  net: "Net Profit",
  margin: "Margin",
  orders: "Orders",
  units: "Units",
  refund_rate: "Refund Rate",
  ppc_spend: "PPC Spend",
  ppc_sales: "PPC Sales",
  acos: "ACoS",
  cpc: "CPC",
  net_payout: "Net Payout",
  product_payout: "Product Payout",
  unallocated_payout: "Unallocated Payout",
  sns_revenue: "Subscribe & Save Revenue",
  sns_net: "Subscribe & Save Net",
  sns_active_subs: "Active Subscribers",
  sns_new_buyers: "New SnS Buyers",
  sns_oos_rate: "SnS Out-of-Stock Rate",
  avg_rating: "Avg Rating",
  review_count: "Review Count",
  negative_review_pct: "Negative Review %",
  tracked_keywords_count: "Tracked Keywords",
  avg_keyword_rank: "Avg Keyword Rank",
};

// Preferred display order — sales and ad spend first since those are what people look for.
const METRIC_ORDER = [
  "sales",
  "ad_spend",
  "ppc_revenue",
  "organic_revenue",
  "units_sold",
  "roas",
  "tacos",
  "ctr",
  "cvr",
  "amount_spent",
  "impressions",
  "clicks",
  "reach",
  "link_click",
  "lead",
  "cost_per_lead",
  "gmv",
  "affiliate_gmv",
  "video_gmv",
  "live_gmv",
  "shop_health_score",
  "active_creators",
  "revenue",
  "net",
  "margin",
  "orders",
  "units",
  "refund_rate",
  "ppc_spend",
  "ppc_sales",
  "acos",
  "cpc",
  "net_payout",
  "product_payout",
  "unallocated_payout",
  "sns_revenue",
  "sns_net",
  "sns_active_subs",
  "sns_new_buyers",
  "sns_oos_rate",
  "avg_rating",
  "review_count",
  "negative_review_pct",
  "tracked_keywords_count",
  "avg_keyword_rank",
];

// Cycled by series index (metric × channel combo), not just channel, now that more than one line
// can be on screen at once.
const SERIES_COLORS = ["#2447FF", "#D6FF3F", "#DC2626", "#6B6558", "#0EA5A0", "#B45309", "#7C3AED", "#059669"];

const CURRENCY_METRICS = [
  "sales",
  "ad_spend",
  "ppc_revenue",
  "organic_revenue",
  "amount_spent",
  "cost_per_lead",
  "gmv",
  "affiliate_gmv",
  "video_gmv",
  "live_gmv",
  "revenue",
  "net",
  "ppc_spend",
  "ppc_sales",
  "cpc",
  "net_payout",
  "product_payout",
  "unallocated_payout",
  "sns_revenue",
  "sns_net",
];
const PERCENT_METRICS = ["tacos", "ctr", "cvr", "margin", "refund_rate", "acos", "sns_oos_rate", "negative_review_pct"];

function formatValue(metricKey: string, value: number): string {
  if (CURRENCY_METRICS.includes(metricKey)) {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  if (PERCENT_METRICS.includes(metricKey)) return `${value.toFixed(1)}%`;
  if (metricKey === "roas") return `${value.toFixed(2)}x`;
  if (metricKey === "avg_rating") return `${value.toFixed(1)}★`;
  return value.toLocaleString();
}

function formatDate(iso: string): string {
  // Postgres returns `date` columns as full ISO timestamps ("2026-08-30T00:00:00.000Z"), not
  // bare "YYYY-MM-DD" — `new Date()` parses either form correctly on its own, no need to (and
  // don't) append a time suffix, which would double up and produce an Invalid Date.
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

const WIDTH = 720;
const HEIGHT = 240;
const MARGIN = { top: 16, right: 16, bottom: 28, left: 56 };

interface Series {
  key: string; // metric::channel
  metric: string;
  channel: string;
  label: string;
  color: string;
  rows: MetricPoint[];
  min: number;
  max: number;
}

export function MetricsChart({ series: rawSeries }: { series: MetricPoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const availableMetrics = useMemo(() => {
    const present = new Set(rawSeries.map((p) => p.metric_key));
    return METRIC_ORDER.filter((m) => present.has(m));
  }, [rawSeries]);

  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(() => (availableMetrics[0] ? [availableMetrics[0]] : []));
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const activeMetrics = selectedMetrics.filter((m) => availableMetrics.includes(m));
  const effectiveMetrics = activeMetrics.length > 0 ? activeMetrics : availableMetrics.slice(0, 1);
  const multiMode = effectiveMetrics.length > 1;

  function toggleMetric(m: string) {
    setSelectedMetrics((prev) => {
      const has = prev.includes(m);
      if (has) {
        const next = prev.filter((x) => x !== m);
        return next.length > 0 ? next : prev; // never let it go empty
      }
      return [...prev, m];
    });
  }

  const { seriesList, dates } = useMemo(() => {
    const list: Series[] = [];
    for (const metric of effectiveMetrics) {
      const filtered = rawSeries.filter((p) => p.metric_key === metric);
      const channelSet = Array.from(new Set(filtered.map((p) => p.channel))).sort();
      for (const ch of channelSet) {
        const rows = filtered.filter((p) => p.channel === ch).sort((a, b) => a.date.localeCompare(b.date));
        const values = rows.map((p) => p.value);
        list.push({
          key: `${metric}::${ch}`,
          metric,
          channel: ch,
          label: channelSet.length > 1 || effectiveMetrics.length > 1 ? `${METRIC_LABELS[metric] ?? metric} · ${ch}` : METRIC_LABELS[metric] ?? metric,
          color: "", // assigned after sort for stable ordering
          rows,
          min: Math.min(0, ...values),
          max: Math.max(1, ...values),
        });
      }
    }
    list.forEach((s, i) => {
      s.color = SERIES_COLORS[i % SERIES_COLORS.length];
    });
    const allDates = Array.from(new Set(list.flatMap((s) => s.rows.map((r) => r.date)))).sort();
    return { seriesList: list, dates: allDates };
  }, [rawSeries, effectiveMetrics]);

  if (availableMetrics.length === 0) {
    return <p>No metrics for this period yet.</p>;
  }

  const innerWidth = WIDTH - MARGIN.left - MARGIN.right;
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

  const x = (date: string) => {
    if (dates.length <= 1) return MARGIN.left + innerWidth / 2;
    const idx = dates.indexOf(date);
    return MARGIN.left + (idx / (dates.length - 1)) * innerWidth;
  };

  // Single metric: plot on its own real value axis (unchanged behavior). Multiple metrics: each
  // series is normalized 0..1 within its own min/max so wildly different scales (e.g. "Orders": 43
  // vs "Revenue": $16,071) can share one chart — the axis becomes relative, and the hover tooltip
  // carries the real formatted value per series instead.
  const singleMinValue = seriesList[0]?.min ?? 0;
  const singleMaxValue = seriesList[0]?.max ?? 1;
  const y = (value: number, s: Series) => {
    if (!multiMode) {
      const range = singleMaxValue - singleMinValue || 1;
      return MARGIN.top + innerHeight - ((value - singleMinValue) / range) * innerHeight;
    }
    const range = s.max - s.min || 1;
    return MARGIN.top + innerHeight - ((value - s.min) / range) * innerHeight;
  };

  const gridLines = 4;
  const gridValues = multiMode
    ? Array.from({ length: gridLines + 1 }, (_, i) => i / gridLines) // 0%..100%
    : Array.from({ length: gridLines + 1 }, (_, i) => singleMinValue + ((singleMaxValue - singleMinValue) * i) / gridLines);

  // Thin out x-axis date labels so they don't overlap when there are many days.
  const labelEvery = Math.max(1, Math.ceil(dates.length / 7));
  const dateLabels = dates.filter((_, i) => i % labelEvery === 0 || i === dates.length - 1);

  const hoveredDate = hoverIndex !== null ? dates[hoverIndex] : null;

  function handlePointerMove(e: React.MouseEvent<SVGRectElement>) {
    const svg = svgRef.current;
    if (!svg || dates.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const viewBoxX = (e.clientX - rect.left) * scaleX;
    const ratio = Math.min(1, Math.max(0, (viewBoxX - MARGIN.left) / innerWidth));
    const idx = Math.round(ratio * (dates.length - 1));
    setHoverIndex(Math.min(dates.length - 1, Math.max(0, idx)));
  }

  const tooltipRows =
    hoveredDate !== null
      ? seriesList
          .map((s) => ({ s, point: s.rows.find((r) => r.date === hoveredDate) }))
          .filter((r): r is { s: Series; point: MetricPoint } => !!r.point)
      : [];

  // Keep the tooltip from clipping off the right edge of the card — flip at the midpoint rather
  // than late, since a multi-metric tooltip (several rows, longer "Metric · channel" labels) is
  // wider than the single-metric case this was originally tuned for.
  const hoverXPct = hoveredDate ? (x(hoveredDate) / WIDTH) * 100 : 0;
  const tooltipAlign = hoverXPct > 50 ? "right" : "left";

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {availableMetrics.map((m) => {
          const isActive = effectiveMetrics.includes(m);
          return (
            <button
              key={m}
              type="button"
              onClick={() => toggleMetric(m)}
              className={isActive ? undefined : "secondary"}
              style={{ padding: "4px 12px", fontSize: "0.8rem" }}
              aria-pressed={isActive}
            >
              {METRIC_LABELS[m] ?? m}
            </button>
          );
        })}
      </div>

      <div style={{ position: "relative" }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          style={{ width: "100%", height: "auto", display: "block" }}
        >
          {gridValues.map((v, i) => (
            <g key={i}>
              <line
                x1={MARGIN.left}
                x2={WIDTH - MARGIN.right}
                y1={multiMode ? MARGIN.top + innerHeight - v * innerHeight : y(v, seriesList[0])}
                y2={multiMode ? MARGIN.top + innerHeight - v * innerHeight : y(v, seriesList[0])}
                stroke="var(--paper-2)"
                strokeWidth={1}
              />
              <text
                x={MARGIN.left - 8}
                y={multiMode ? MARGIN.top + innerHeight - v * innerHeight : y(v, seriesList[0])}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10}
                fill="var(--muted)"
              >
                {multiMode ? `${Math.round(v * 100)}%` : formatValue(effectiveMetrics[0], v)}
              </text>
            </g>
          ))}

          {dateLabels.map((d) => (
            <text key={d} x={x(d)} y={HEIGHT - 8} textAnchor="middle" fontSize={10} fill="var(--muted)">
              {formatDate(d)}
            </text>
          ))}

          {/* Hover guideline + highlighted points */}
          {hoveredDate && (
            <line
              x1={x(hoveredDate)}
              x2={x(hoveredDate)}
              y1={MARGIN.top}
              y2={MARGIN.top + innerHeight}
              stroke="var(--muted)"
              strokeWidth={1}
              strokeDasharray="3,3"
            />
          )}

          {seriesList.map((s) => {
            const path = s.rows.map((p, j) => `${j === 0 ? "M" : "L"} ${x(p.date)} ${y(p.value, s)}`).join(" ");
            return (
              <g key={s.key}>
                <path d={path} fill="none" stroke={s.color} strokeWidth={2} />
                {s.rows.map((p) => {
                  const isHovered = p.date === hoveredDate;
                  return (
                    <circle
                      key={p.date}
                      cx={x(p.date)}
                      cy={y(p.value, s)}
                      r={isHovered ? 5 : 3}
                      fill={s.color}
                      stroke={isHovered ? "#fff" : "none"}
                      strokeWidth={isHovered ? 2 : 0}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* Invisible capture layer for hover tracking, drawn last so it sits on top */}
          <rect
            x={MARGIN.left}
            y={MARGIN.top}
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            onMouseMove={handlePointerMove}
            onMouseLeave={() => setHoverIndex(null)}
          />
        </svg>

        {tooltipRows.length > 0 && hoveredDate && (
          <div
            style={{
              position: "absolute",
              top: 4,
              [tooltipAlign]: `${tooltipAlign === "left" ? hoverXPct + 2 : 100 - hoverXPct + 2}%`,
              background: "#fff",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: "0.75rem",
              boxShadow: "0 2px 8px rgba(11,13,18,0.12)",
              pointerEvents: "none",
              whiteSpace: "nowrap",
              zIndex: 10,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{formatDate(hoveredDate)}</div>
            {tooltipRows.map(({ s, point }) => (
              <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                <span style={{ color: "var(--muted)" }}>{s.label}</span>
                <strong style={{ marginLeft: "auto", paddingLeft: 10 }}>{formatValue(s.metric, point.value)}</strong>
              </div>
            ))}
          </div>
        )}
      </div>

      {seriesList.length > 1 && (
        <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
          {seriesList.map((s) => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem" }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: s.color, display: "inline-block" }} />
              {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
