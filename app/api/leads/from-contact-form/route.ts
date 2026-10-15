import { insertLead } from "@/lib/leads";

// Public, unauthenticated — called directly (client-side, cross-origin) from the marketing
// site's contact form (flagshipgrowth.com/contact.html), not from anywhere inside this app. Added
// to middleware.ts's public-route matcher for that reason. CORS is scoped to that one origin.
const ALLOWED_ORIGIN = "https://flagshipgrowth.com";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ ok: false }, { status: 400, headers: corsHeaders() });

  // The form's hidden `_honey` field (contact.html) should always be empty for a real visitor —
  // silently drop instead of erroring, so a bot gets no signal its submission was rejected.
  if (body.honey) return Response.json({ ok: true }, { headers: corsHeaders() });

  const companyName = String(body.company ?? "").trim();
  const contactName = String(body.name ?? "").trim();
  if (!companyName || !contactName) {
    return Response.json({ ok: false, error: "Missing name or company" }, { status: 400, headers: corsHeaders() });
  }

  const notesParts: string[] = [];
  if (body.revenue) notesParts.push(`Monthly revenue: ${body.revenue}`);
  if (body.note) notesParts.push(String(body.note).trim());

  const text = (key: string) => {
    const v = String(body[key] ?? "").trim();
    return v || null;
  };

  await insertLead({
    companyName,
    contactName,
    email: String(body.email ?? "").trim() || null,
    source: "Website contact form",
    notes: notesParts.length > 0 ? notesParts.join("\n\n") : null,
    stage: "new",
    rawSubmission: body,
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    gclid: text("gclid"),
    fbclid: text("fbclid"),
    referrer: text("referrer"),
  });

  return Response.json({ ok: true }, { headers: corsHeaders() });
}
