import { upsertBrandMetrics, type BrandMetricInput } from "@/lib/metrics";

// Called by the scheduled tiktok-shop-daily-sync agent — same shared-secret pattern as
// /api/marketing/sync, since only an interactive/agent Claude session can reach the Euka/Reacher
// MCP connectors, not a Netlify serverless function. channel is always "tiktok_shop" — this route
// only ever writes that one channel, never lets the caller pick.
export async function POST(req: Request) {
  const secret = process.env.TIKTOK_SHOP_SYNC_SECRET;
  if (!secret) return Response.json({ ok: false, error: "Not configured" }, { status: 500 });

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const rows = body?.rows;
  if (!Array.isArray(rows)) {
    return Response.json({ ok: false, error: "Expected { rows: [{ brandId, date, metric_key, value }] }" }, { status: 400 });
  }

  const parsed: BrandMetricInput[] = [];
  for (const r of rows) {
    if (typeof r?.brandId !== "string" || typeof r?.date !== "string" || typeof r?.metric_key !== "string" || typeof r?.value !== "number") {
      return Response.json({ ok: false, error: "Bad row shape", row: r }, { status: 400 });
    }
    parsed.push({ brandId: r.brandId, channel: "tiktok_shop", date: r.date, metric_key: r.metric_key, value: r.value });
  }

  await upsertBrandMetrics(parsed);
  return Response.json({ ok: true, upserted: parsed.length });
}
