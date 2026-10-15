import { ingestProspects, parseProspectInput, type ProspectInput } from "@/lib/outbound";

// Called by the outbound-sourcing agent (automations/outbound-sourcing/SKILL.md). Same
// shared-secret pattern as /api/sellerise/sync: only a Claude agent session can reach the
// Helium10 MCP connector, so the agent does the sourcing and research and posts the results here.
// Dedupe, suppression and scoring all happen server-side (lib/outbound.ts), so the agent can't
// re-contact a client or an opt-out by mistake.
const MAX_PROSPECTS_PER_CALL = 50;

export async function POST(req: Request) {
  const secret = process.env.OUTBOUND_SYNC_SECRET;
  if (!secret) return Response.json({ ok: false, error: "Not configured" }, { status: 500 });

  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const prospects = body?.prospects;
  if (!Array.isArray(prospects)) {
    return Response.json({ ok: false, error: "Expected { prospects: [{ companyName, ... }], source? }" }, { status: 400 });
  }
  if (prospects.length > MAX_PROSPECTS_PER_CALL) {
    return Response.json({ ok: false, error: `Send at most ${MAX_PROSPECTS_PER_CALL} prospects per call` }, { status: 400 });
  }

  const parsed: ProspectInput[] = [];
  const invalid: { index: number; error: string }[] = [];
  prospects.forEach((p: unknown, index: number) => {
    const r = parseProspectInput(p);
    if (typeof r === "string") invalid.push({ index, error: r });
    else parsed.push(r);
  });

  const source = typeof body?.source === "string" && body.source.trim() ? body.source.trim() : "outbound-sourcing agent";
  const result = await ingestProspects(parsed, source);
  return Response.json({ ok: true, ...result, invalid });
}
