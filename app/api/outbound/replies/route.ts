import { recordReply, triggerClassification } from "@/lib/outbound-replies";

// Inbound replies from the sending tool's webhook (or a reply-sync agent). Same shared-secret check
// as the other /api/outbound endpoints. Recording is instant and stops the sequence right away;
// classification (and the Slack alert for interested replies) runs in a background function.
export async function POST(req: Request) {
  const secret = process.env.OUTBOUND_SYNC_SECRET;
  if (!secret) return Response.json({ ok: false, error: "Not configured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const b = await req.json().catch(() => null);
  const channel = b?.channel ?? "email";
  if (!["email", "linkedin", "instagram"].includes(channel) || typeof b?.body !== "string" || !b.body.trim()) {
    return Response.json(
      { ok: false, error: "Expected { channel: email|linkedin|instagram, body, fromAddress?, receivedAt?, externalId?, prospectId? }" },
      { status: 400 }
    );
  }
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const result = await recordReply({
    channel,
    body: b.body.slice(0, 20000),
    fromAddress: str(b.fromAddress),
    receivedAt: str(b.receivedAt),
    externalId: str(b.externalId),
    prospectId: str(b.prospectId),
  });
  if ("error" in result) return Response.json({ ok: false, error: result.error }, { status: 404 });
  if (!result.duplicate) await triggerClassification(result.replyId);
  return Response.json({ ok: true, ...result });
}
