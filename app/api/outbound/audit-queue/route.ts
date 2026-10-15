import { claimAuditQueue } from "@/lib/outbound-audit";

// Called by the outbound-audit agent (automations/outbound-audit/SKILL.md) to get its next batch of
// Tier A/B brands to audit. Same shared-secret check as /api/outbound/ingest. POST, not GET,
// because it claims the brands it returns (they move to "audit pending").
const MAX_BATCH = 25;

export async function POST(req: Request) {
  const secret = process.env.OUTBOUND_SYNC_SECRET;
  if (!secret) return Response.json({ ok: false, error: "Not configured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const requested = typeof body?.limit === "number" ? Math.floor(body.limit) : 10;
  const limit = Math.min(Math.max(requested, 1), MAX_BATCH);

  const prospects = await claimAuditQueue(limit);
  return Response.json({ ok: true, prospects });
}
