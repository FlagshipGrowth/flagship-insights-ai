import { upsertAgencyMarketingMetrics, type AgencyMetricInput } from "@/lib/marketing";

// Called by the daily marketing-sync cron job — a scheduled agent session, not a browser or a
// Netlify serverless function, since only an interactive/agent Claude session can reach the Meta
// Ads MCP connector. Authenticated with a shared secret (same style as the Slack/Clerk webhook
// signing secrets) rather than Clerk, since the caller has no user session.
export async function POST(req: Request) {
  const secret = process.env.MARKETING_SYNC_SECRET;
  if (!secret) return Response.json({ ok: false, error: "Not configured" }, { status: 500 });

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const rows = body?.rows;
  if (!Array.isArray(rows)) {
    return Response.json({ ok: false, error: "Expected { rows: [...] }" }, { status: 400 });
  }

  const parsed: AgencyMetricInput[] = [];
  for (const r of rows) {
    if (
      typeof r?.channel !== "string" ||
      typeof r?.date !== "string" ||
      typeof r?.metric_key !== "string" ||
      typeof r?.value !== "number"
    ) {
      return Response.json({ ok: false, error: "Bad row shape", row: r }, { status: 400 });
    }
    parsed.push({ channel: r.channel, date: r.date, metric_key: r.metric_key, value: r.value });
  }

  await upsertAgencyMarketingMetrics(parsed);
  return Response.json({ ok: true, upserted: parsed.length });
}
