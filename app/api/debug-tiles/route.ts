import { getBrandPerformanceTiles } from "@/lib/metrics";

// temporary debug route, shared-secret checked, delete after use
export async function GET(req: Request) {
  const secret = process.env.SELLERISE_SYNC_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const period = (url.searchParams.get("period") ?? "mtd") as any;
  const brandId = "5cf54f6b-a915-4d44-8144-750e46dd582f"; // Dormeo US

  const tiles = await getBrandPerformanceTiles(brandId, period);
  return Response.json({ ok: true, period, tiles: tiles.map((t) => ({ key: t.key, value: t.value, wowChangePct: t.wowChangePct, sparklinePoints: t.sparkline.length })) });
}
