import { AUDIT_KINDS, createAudit, parseFindings, type AuditKind } from "@/lib/outbound-audit";

// Called by the outbound-audit agent once per audited brand. Same shared-secret check as
// /api/outbound/ingest. The audit is stored as a draft: its public link stays dark until an owner
// approves it on the prospect's page in the CRM.
export async function POST(req: Request) {
  const secret = process.env.OUTBOUND_SYNC_SECRET;
  if (!secret) return Response.json({ ok: false, error: "Not configured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const prospectId = body?.prospectId;
  const kind = body?.kind ?? "deep";
  const headline = typeof body?.headline === "string" ? body.headline.trim().slice(0, 200) : "";
  if (typeof prospectId !== "string" || !/^[0-9a-f-]{36}$/i.test(prospectId)) {
    return Response.json({ ok: false, error: "prospectId (uuid) is required" }, { status: 400 });
  }
  if (!(AUDIT_KINDS as readonly string[]).includes(kind)) {
    return Response.json({ ok: false, error: `kind must be one of ${AUDIT_KINDS.join(", ")}` }, { status: 400 });
  }
  if (!headline) return Response.json({ ok: false, error: "headline is required" }, { status: 400 });

  const findings = parseFindings(body?.findings);
  if (typeof findings === "string") return Response.json({ ok: false, error: findings }, { status: 400 });

  const result = await createAudit({
    prospectId,
    kind: kind as AuditKind,
    headline,
    findings,
    helium10Calls: typeof body?.helium10Calls === "number" ? Math.round(body.helium10Calls) : null,
    originalImageUrl: typeof body?.originalImageUrl === "string" ? body.originalImageUrl : null,
    mainImageBase64: typeof body?.mainImageBase64 === "string" ? body.mainImageBase64 : null,
    mainImageContentType: typeof body?.mainImageContentType === "string" ? body.mainImageContentType : null,
  });
  if (typeof result === "string") return Response.json({ ok: false, error: result }, { status: 400 });

  const origin = new URL(req.url).origin;
  return Response.json({ ok: true, auditId: result.auditId, previewUrl: `${origin}/audit/${result.shareToken}` });
}
