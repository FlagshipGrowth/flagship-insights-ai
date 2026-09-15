"use client";

import { useMemo, useState } from "react";

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
];

const CHANNEL_COLORS = ["#2447FF", "#D6FF3F", "#6B6558", "#DC2626"];

function formatValue(metricKey: string, value: number): string {
  if (["sales", "ad_spend", "ppc_revenue", "organic_revenue", "amount_spent", "cost_per_lead"].includes(metricKey)) {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  if (["tacos", "ctr", "cvr"].includes(metricKey)) return `${value.toFixed(1)}%`;
  if (metricKey === "roas") return `${value.toFixed(2)}x`;
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

export function MetricsChart({ series }: { series: MetricPoint[] }) {
  const availableMetrics = useMemo(() => {
    const present = new Set(series.map((p) => p.metric_key));
    return METRIC_ORDER.filter((m) => present.has(m));
  }, [series]);

  const [metric, setMetric] = useState(availableMetrics[0] ?? "sales");
  const activeMetric = availableMetrics.includes(metric) ? metric : availableMetrics[0];

  const { channels, points, minValue, maxValue, dates } = useMemo(() => {
    const filtered = series.filter((p) => p.metric_key === activeMetric);
    const channelSet = Array.from(new Set(filtered.map((p) => p.channel))).sort();
    const byChannel = new Map<string, MetricPoint[]>();
    for (const ch of channelSet) {
      byChannel.set(
        ch,
        filtered.filter((p) => p.channel === ch).sort((a, b) => a.date.localeCompare(b.date))
      );
    }
    const allValues = filtered.map((p) => p.value);
    const allDates = Array.from(new Set(filtered.map((p) => p.date))).sort();
    return {
      channels: channelSet,
      points: byChannel,
      minValue: Math.min(0, ...allValues),
      maxValue: Math.max(1, ...allValues),
      dates: allDates,
    };
  }, [series, activeMetric]);

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
  const y = (value: number) => {
    const range = maxValue - minValue || 1;
    return MARGIN.top + innerHeight - ((value - minValue) / range) * innerHeight;
  };

  const gridLines = 4;
  const gridValues = Array.from({ length: gridLines + 1 }, (_, i) => minValue + ((maxValue - minValue) * i) / gridLines);

  // Thin out x-axis date labels so they don't overlap when there are many days.
  const labelEvery = Math.max(1, Math.ceil(dates.length / 7));
  const dateLabels = dates.filter((_, i) => i % labelEvery === 0 || i === dates.length - 1);

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {availableMetrics.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMetric(m)}
            className={m === activeMetric ? undefined : "secondary"}
            style={{ padding: "4px 12px", fontSize: "0.8rem" }}
          >
            {METRIC_LABELS[m] ?? m}
          </button>
        ))}
      </div>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {gridValues.map((v, i) => (
          <g key={i}>
            <line
              x1={MARGIN.left}
              x2={WIDTH - MARGIN.right}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--paper-2)"
              strokeWidth={1}
            />
            <text x={MARGIN.left - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="var(--muted)">
              {formatValue(activeMetric, v)}
            </text>
          </g>
        ))}

        {dateLabels.map((d) => (
          <text
            key={d}
            x={x(d)}
            y={HEIGHT - 8}
            textAnchor="middle"
            fontSize={10}
            fill="var(--muted)"
          >
            {formatDate(d)}
          </text>
        ))}

        {channels.map((ch, i) => {
          const rows = points.get(ch) ?? [];
          const color = CHANNEL_COLORS[i % CHANNEL_COLORS.length];
          const path = rows.map((p, j) => `${j === 0 ? "M" : "L"} ${x(p.date)} ${y(p.value)}`).join(" ");
          return (
            <g key={ch}>
              <path d={path} fill="none" stroke={color} strokeWidth={2} />
              {rows.map((p) => (
                <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r={3} fill={color}>
                  <title>
                    {ch} · {formatDate(p.date)}: {formatValue(activeMetric, p.value)}
                  </title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>

      {channels.length > 1 && (
        <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
          {channels.map((ch, i) => (
            <div key={ch} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem" }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: CHANNEL_COLORS[i % CHANNEL_COLORS.length],
                  display: "inline-block",
                }}
              />
              {ch}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
