import { handleInstantlyEvent, type InstantlyEvent } from "@/lib/outbound-sequencer";

// Instantly's webhook for the engine's campaign (created by "Connect Instantly" on
// /internal/crm/outbound, which sets this Authorization header). Records sends, replies,
// unsubscribes and bounces. outbound-instantly-sync.ts pulls the same data every 15 minutes,
// so a missed delivery here is caught up there.
export async function POST(req: Request) {
  const secret = process.env.OUTBOUND_SYNC_SECRET;
  if (!secret) return Response.json({ ok: false, error: "Not configured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const event = (await req.json().catch(() => null)) as InstantlyEvent | null;
  if (!event || typeof event !== "object") return Response.json({ ok: false, error: "Expected JSON" }, { status: 400 });
  const note = await handleInstantlyEvent(event);
  console.log("instantly-webhook", event.event_type, note);
  return Response.json({ ok: true, note });
}
