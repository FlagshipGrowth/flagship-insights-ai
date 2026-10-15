import { getDb } from "../../lib/db";
import { evaluateRunningTest } from "../../lib/outbound-ab";
import { closeFinishedSequences, enrollNextProspects, getSettings } from "../../lib/outbound-sequencer";
import { postSlackMessage } from "../../lib/slack";
import { findEmailsBatch } from "../../lib/outbound-email-finder";

// The engine's daily run (kicked off by outbound-daily.ts, or "Run daily step now" in the CRM):
// 1. conclude the A/B test if it has enough sends (the next one starts at enrollment),
//    and look up verified emails with Apollo for brands that don't have one yet,
// 2. write and schedule sequences for today's new brands, up to the daily cap,
// 3. close out sequences that finished without a reply.
// Writing copy is one Claude call per brand, hence a background function (15-minute limit).
export default async (req: Request) => {
  if (req.headers.get("authorization") !== `Bearer ${process.env.OUTBOUND_SYNC_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const sql = getDb();
  const settings = await getSettings();
  const test = await evaluateRunningTest();
  // Find verified emails first, so today's enrollment can include the brands just found.
  const lookups = await findEmailsBatch(15).catch((err) => [{ error: (err as Error).message }]);

  const [{ n: enrolledToday }] = await sql`
    select count(distinct prospect_id)::int as n from outbound_touches where step_day = 1 and created_at >= date_trunc('day', now())
  `;
  const enroll = await enrollNextProspects(Math.max(0, settings.dailyNewBrands - enrolledToday));
  const closed = await closeFinishedSequences();
  const summary = { test, emailLookups: lookups.length, enrolled: enroll.enrolled.length, skipped: enroll.skipped, closed };
  console.log("outbound-daily", JSON.stringify(summary));

  const channel = process.env.OUTBOUND_SLACK_CHANNEL_ID;
  if (channel && process.env.SLACK_BOT_TOKEN && (enroll.enrolled.length > 0 || test.concluded)) {
    const toReview = enroll.enrolled.reduce((s, e) => s + e.needsReview, 0);
    const origin = process.env.URL ?? "";
    await postSlackMessage({
      channel,
      text: [
        `Outbound: ${enroll.enrolled.length} new brands queued (${toReview} messages to review).`,
        test.concluded && `A/B test concluded, winner: ${test.winner}.`,
        toReview > 0 && `<${origin}/internal/crm/outbound/queue|Review today's messages>`,
      ]
        .filter(Boolean)
        .join(" "),
    }).catch(() => undefined);
  }
};
