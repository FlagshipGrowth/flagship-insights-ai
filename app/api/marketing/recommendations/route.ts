import { insertMarketingRecommendation, type RecommendationCategory } from "@/lib/marketing";

// Written to by the scheduled Meta Ad Manager agent (performance callouts, and new creative it
// uploaded to Meta as a paused ad awaiting review) — same shared-secret auth as
// /api/marketing/sync, since the caller has no user session.
export async function POST(req: Request) {
  const secret = process.env.MARKETING_SYNC_SECRET;
  if (!secret) return Response.json({ ok: false, error: "Not configured" }, { status: 500 });

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const category = body?.category as RecommendationCategory;
  const title = body?.title;
  const text = body?.body;
  const metaRef = body?.metaRef ?? null;

  if ((category !== "performance" && category !== "creative") || typeof title !== "string" || typeof text !== "string") {
    return Response.json({ ok: false, error: "Expected { category: 'performance'|'creative', title, body, metaRef? }" }, { status: 400 });
  }

  await insertMarketingRecommendation({ category, title, body: text, metaRef });
  return Response.json({ ok: true });
}
