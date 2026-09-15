import { upsertMarketingCreative } from "@/lib/marketing";

// Written to by the scheduled Meta sync task, same shared-secret auth as /api/marketing/sync and
// /api/marketing/recommendations. Image bytes come in as base64 (not a Meta CDN URL — those are
// signed links that expire within hours/days) and are stored directly so the dashboard's <img>
// tags never break.
export async function POST(req: Request) {
  const secret = process.env.MARKETING_SYNC_SECRET;
  if (!secret) return Response.json({ ok: false, error: "Not configured" }, { status: 500 });

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const metaCreativeId = body?.metaCreativeId;
  const adName = body?.adName;
  const status = body?.status;
  if (typeof metaCreativeId !== "string" || typeof adName !== "string" || typeof status !== "string") {
    return Response.json(
      { ok: false, error: "Expected { metaCreativeId, adName, status, headline?, bodyCopy?, imageBase64?, imageContentType? }" },
      { status: 400 }
    );
  }

  await upsertMarketingCreative({
    metaCreativeId,
    adName,
    status,
    headline: body?.headline ?? null,
    bodyCopy: body?.bodyCopy ?? null,
    imageBase64: body?.imageBase64 ?? null,
    imageContentType: body?.imageContentType ?? null,
  });
  return Response.json({ ok: true });
}
