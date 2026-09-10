import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "./lib/db";
import { getPeriodComparison } from "./lib/metrics";
import { runChannelSubagent, CHANNEL_SYSTEM_PROMPTS } from "./lib/insights/subagents";
import { synthesize } from "./lib/insights/synthesis";

const DEFAULT_MODEL = "claude-sonnet-5";

// Callable on demand (e.g. a "Generate insight" button, or chained after sync-nightly once
// that's producing real data) rather than on its own schedule — running it costs an API call
// per channel per brand, so it shouldn't fire more often than the data actually changes.
export default async (req: Request) => {
  const { brandId } = (await req.json()) as { brandId?: string };
  if (!brandId) {
    return new Response("brandId is required", { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response("ANTHROPIC_API_KEY is not set.", { status: 500 });
  }

  const sql = getDb();
  const brands = await sql`select name, channels_enabled from brands where id = ${brandId}`;
  if (brands.length === 0) {
    return new Response("brand not found", { status: 404 });
  }
  const brand = brands[0] as { name: string; channels_enabled: string[] };

  const channels = brand.channels_enabled.filter((c) => c in CHANNEL_SYSTEM_PROMPTS);
  if (channels.length === 0) {
    return new Response(
      JSON.stringify({ message: "No channels with a subagent are connected for this brand yet." }),
      { status: 200 }
    );
  }

  const client = new Anthropic();
  const findings = await Promise.all(
    channels.map(async (channel) => {
      const data = await getPeriodComparison(brandId, channel);
      return runChannelSubagent(client, channel, brand.name, data, DEFAULT_MODEL);
    })
  );

  const recommendation = await synthesize(client, brand.name, findings, DEFAULT_MODEL);

  await sql`
    insert into insights (brand_id, period, summary, recommendations, source_refs)
    values (${brandId}, 'last_30_days', ${recommendation}, ${JSON.stringify(findings)}, '[]')
  `;

  return new Response(JSON.stringify({ recommendation }), { status: 200 });
};
