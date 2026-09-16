import { upsertBrandMetrics, type BrandMetricInput } from "@/lib/metrics";
import { insertBrandRecommendation } from "@/lib/brand-recommendations";

// Called by the scheduled sellerise-daily-sync agent — same shared-secret pattern as
// /api/marketing/sync and /api/tiktok-shop/sync, since only an interactive/agent Claude session
// can reach the Sellerise MCP connector. metricRows always write channel "amazon" (Sellerise is
// now the real data source behind that existing channel); recommendationRows are list-shaped
// findings (alerts, PPC waste, etc.) tagged source "sellerise".
export async function POST(req: Request) {
  const secret = process.env.SELLERISE_SYNC_SECRET;
  if (!secret) return Response.json({ ok: false, error: "Not configured" }, { status: 500 });

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const metricRows = body?.metricRows ?? [];
  const recommendationRows = body?.recommendationRows ?? [];
  if (!Array.isArray(metricRows) || !Array.isArray(recommendationRows)) {
    return Response.json(
      { ok: false, error: "Expected { metricRows: [{brandId, date, metric_key, value}], recommendationRows: [{brandId, category, severity?, title, body, metaRef?}] }" },
      { status: 400 }
    );
  }

  const parsedMetrics: BrandMetricInput[] = [];
  for (const r of metricRows) {
    if (typeof r?.brandId !== "string" || typeof r?.date !== "string" || typeof r?.metric_key !== "string" || typeof r?.value !== "number") {
      return Response.json({ ok: false, error: "Bad metric row shape", row: r }, { status: 400 });
    }
    parsedMetrics.push({ brandId: r.brandId, channel: "amazon", date: r.date, metric_key: r.metric_key, value: r.value });
  }

  for (const r of recommendationRows) {
    if (typeof r?.brandId !== "string" || typeof r?.category !== "string" || typeof r?.title !== "string" || typeof r?.body !== "string") {
      return Response.json({ ok: false, error: "Bad recommendation row shape", row: r }, { status: 400 });
    }
  }

  await upsertBrandMetrics(parsedMetrics);
  for (const r of recommendationRows) {
    await insertBrandRecommendation({
      brandId: r.brandId,
      source: "sellerise",
      category: r.category,
      severity: r.severity ?? null,
      title: r.title,
      body: r.body,
      metaRef: r.metaRef ?? null,
    });
  }

  return Response.json({ ok: true, metricsUpserted: parsedMetrics.length, recommendationsInserted: recommendationRows.length });
}
