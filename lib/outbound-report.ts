import { getDb } from "./db";
import { getActiveWeights } from "./outbound";
import { HELIUM10_COST_PER_CALL } from "./outbound-audit";
import { getRecentTests, type TestSummary } from "./outbound-ab";
import { SIGNAL_KEYS, SIGNAL_LABELS, type ScoringWeights, type SignalKey } from "./outbound-scoring";
import { getSettings } from "./outbound-sequencer";

// The build plan's success metrics, measured from day one, plus the monthly re-weighting
// suggestion for the scoring model. Read by /internal/crm/outbound/report and posted weekly to
// Slack.

export interface ChannelRow {
  channel: string;
  sent: number;
  brandsContacted: number;
  positiveReplies: number;
  positiveRate: number | null;
}

export interface StepRow {
  channel: string;
  stepDay: number;
  sent: number;
  positiveReplies: number;
  positiveRate: number | null;
}

export interface TierRow {
  tier: string;
  prospects: number;
  auditsSent: number;
  contacted: number;
  replied: number;
  interested: number;
  booked: number;
  auditToCallRate: number | null;
}

export interface OutboundReport {
  days: number;
  newBrandsPerDay: { date: string; brands: number }[];
  touchesPerDay: { date: string; email: number; linkedin: number; instagram: number }[];
  channels: ChannelRow[];
  steps: StepRow[];
  tiers: TierRow[];
  callsBooked: number;
  helium10Spend: number;
  toolSpend: number;
  costPerBookedCall: number | null;
  tests: TestSummary[];
}

const rate = (num: number, den: number) => (den > 0 ? num / den : null);

export async function getOutboundReport(days = 7): Promise<OutboundReport> {
  const sql = getDb();
  const since = `${days} days`;
  const [newBrands, touches, channels, steps, tiers, [booked], [h10], settings, tests] = await Promise.all([
    sql`
      select d::date as date, count(distinct t.prospect_id)::int as brands
      from generate_series(current_date - (${days}::int - 1), current_date, interval '1 day') d
      left join outbound_touches t on t.step_day = 1 and t.status = 'sent' and t.sent_at::date = d::date
      group by d order by d
    `,
    sql`
      select d::date as date,
             count(t.id) filter (where t.channel = 'email')::int as email,
             count(t.id) filter (where t.channel = 'linkedin')::int as linkedin,
             count(t.id) filter (where t.channel = 'instagram')::int as instagram
      from generate_series(current_date - (${days}::int - 1), current_date, interval '1 day') d
      left join outbound_touches t on t.status = 'sent' and t.sent_at::date = d::date
      group by d order by d
    `,
    sql`
      select t.channel, count(*)::int as sent, count(distinct t.prospect_id)::int as brands,
             count(distinct r.prospect_id) filter (where r.classification = 'interested')::int as positives
      from outbound_touches t
      left join outbound_replies r on r.prospect_id = t.prospect_id and r.channel = t.channel
      where t.status = 'sent' and t.sent_at >= now() - ${since}::interval
      group by t.channel order by t.channel
    `,
    sql`
      select t.channel, t.step_day, count(distinct t.id)::int as sent,
             count(distinct r.id) filter (where r.classification = 'interested')::int as positives
      from outbound_touches t
      left join outbound_replies r on r.touch_id = t.id
      where t.status = 'sent' and t.sent_at >= now() - ${since}::interval
      group by t.channel, t.step_day order by t.step_day, t.channel
    `,
    sql`
      select p.tier, count(*)::int as prospects,
             count(*) filter (where exists (select 1 from outbound_audits a where a.prospect_id = p.id and a.status = 'approved')
                              and exists (select 1 from outbound_touches t where t.prospect_id = p.id and t.status = 'sent'))::int as audits_sent,
             count(*) filter (where exists (select 1 from outbound_touches t where t.prospect_id = p.id and t.status = 'sent'))::int as contacted,
             count(*) filter (where exists (select 1 from outbound_replies r where r.prospect_id = p.id))::int as replied,
             count(*) filter (where exists (select 1 from outbound_replies r where r.prospect_id = p.id and r.classification = 'interested'))::int as interested,
             count(*) filter (where p.status = 'booked')::int as booked
      from outbound_prospects p where p.tier is not null
      group by p.tier order by p.tier
    `,
    sql`select count(*)::int as n from outbound_prospects where status = 'booked' and updated_at >= now() - ${since}::interval`,
    sql`select coalesce(sum(helium10_calls), 0)::int as calls from outbound_audits where created_at >= now() - ${since}::interval`,
    getSettings(),
    getRecentTests(4),
  ]);

  const helium10Spend = h10.calls * HELIUM10_COST_PER_CALL;
  const toolSpend = settings.monthlyToolSpend * (days / 30);
  return {
    days,
    newBrandsPerDay: (newBrands as any[]).map((r) => ({ date: new Date(r.date).toISOString().slice(0, 10), brands: r.brands })),
    touchesPerDay: (touches as any[]).map((r) => ({
      date: new Date(r.date).toISOString().slice(0, 10),
      email: r.email,
      linkedin: r.linkedin,
      instagram: r.instagram,
    })),
    channels: (channels as any[]).map((r) => ({
      channel: r.channel,
      sent: r.sent,
      brandsContacted: r.brands,
      positiveReplies: r.positives,
      positiveRate: rate(r.positives, r.brands),
    })),
    steps: (steps as any[]).map((r) => ({
      channel: r.channel,
      stepDay: r.step_day,
      sent: r.sent,
      positiveReplies: r.positives,
      positiveRate: rate(r.positives, r.sent),
    })),
    tiers: (tiers as any[]).map((r) => ({
      tier: r.tier,
      prospects: r.prospects,
      auditsSent: r.audits_sent,
      contacted: r.contacted,
      replied: r.replied,
      interested: r.interested,
      booked: r.booked,
      auditToCallRate: rate(r.booked, r.audits_sent),
    })),
    callsBooked: booked.n,
    helium10Spend,
    toolSpend,
    costPerBookedCall: booked.n > 0 ? (helium10Spend + toolSpend) / booked.n : null,
    tests,
  };
}

// ---------------------------------------------------------------------------------------------
// Monthly re-weighting suggestion

export interface ReweightSuggestion {
  enoughData: boolean;
  contacted: number;
  positives: number;
  current: ScoringWeights;
  suggested: ScoringWeights | null;
  lift: { key: SignalKey; label: string; positiveAvg: number; otherAvg: number }[];
}

const MIN_POSITIVES = 15;
const MIN_CONTACTED = 150;

/** Compares each signal's average sub-score between brands that replied interested and brands
 * that didn't, and moves weight toward the signals that actually predict interest. Damped to at
 * most half the way, so one noisy month can't swing the model. A suggestion only: an owner applies
 * it from the report page. */
export async function getReweightSuggestion(): Promise<ReweightSuggestion> {
  const sql = getDb();
  const rows = await sql`
    select p.score_breakdown,
           exists (select 1 from outbound_replies r where r.prospect_id = p.id and r.classification = 'interested') as positive
    from outbound_prospects p
    where p.score_breakdown is not null
      and exists (select 1 from outbound_touches t where t.prospect_id = p.id and t.status = 'sent')
  `;
  const active = await getActiveWeights();
  const current: ScoringWeights = {
    listingGaps: active.listingGaps,
    channelGaps: active.channelGaps,
    bsrTrend: active.bsrTrend,
    revenueFit: active.revenueFit,
    triggerEvents: active.triggerEvents,
  };
  const positives = (rows as any[]).filter((r) => r.positive);
  const others = (rows as any[]).filter((r) => !r.positive);
  const avg = (set: any[], key: SignalKey) =>
    set.length === 0 ? 0 : set.reduce((s, r) => s + (r.score_breakdown?.[key]?.subScore ?? 0), 0) / set.length;

  const lift = SIGNAL_KEYS.map((key) => ({ key, label: SIGNAL_LABELS[key], positiveAvg: avg(positives, key), otherAvg: avg(others, key) }));
  const enoughData = positives.length >= MIN_POSITIVES && rows.length >= MIN_CONTACTED;
  if (!enoughData) return { enoughData, contacted: rows.length, positives: positives.length, current, suggested: null, lift };

  // Target weight ∝ current weight × (positive avg / overall avg), then halfway toward it.
  const raw = SIGNAL_KEYS.map((key) => {
    const l = lift.find((x) => x.key === key)!;
    const overall = (l.positiveAvg * positives.length + l.otherAvg * others.length) / rows.length;
    const ratio = overall > 0 ? l.positiveAvg / overall : 1;
    return current[key] * (1 + (ratio - 1) / 2);
  });
  const total = raw.reduce((a, b) => a + b, 0) || 1;
  const scaled = raw.map((w) => Math.max(0, Math.round((w / total) * 100)));
  // Fix rounding so the weights sum to exactly 100.
  const drift = 100 - scaled.reduce((a, b) => a + b, 0);
  scaled[scaled.indexOf(Math.max(...scaled))] += drift;
  const suggested = Object.fromEntries(SIGNAL_KEYS.map((k, i) => [k, scaled[i]])) as unknown as ScoringWeights;
  return { enoughData, contacted: rows.length, positives: positives.length, current, suggested, lift };
}

export function formatReportForSlack(r: OutboundReport): string {
  const pct = (v: number | null) => (v === null ? "–" : `${(v * 100).toFixed(1)}%`);
  const newBrands = r.newBrandsPerDay.reduce((s, d) => s + d.brands, 0);
  const sent = r.touchesPerDay.reduce((s, d) => s + d.email + d.linkedin + d.instagram, 0);
  const lines = [
    `*Outbound engine, last ${r.days} days*`,
    `New brands contacted: ${newBrands} · Messages sent: ${sent} · Calls booked: ${r.callsBooked}`,
    ...r.channels.map((c) => `${c.channel}: ${c.brandsContacted} brands, ${c.positiveReplies} interested (${pct(c.positiveRate)})`),
    ...r.tiers.map((t) => `Tier ${t.tier}: ${t.auditsSent} audits sent, ${t.booked} booked (audit-to-call ${pct(t.auditToCallRate)})`),
    `Cost per booked call: ${r.costPerBookedCall === null ? "–" : `$${r.costPerBookedCall.toFixed(0)}`}`,
  ];
  const running = r.tests.find((t) => t.status === "running");
  if (running)
    lines.push(
      `A/B test (${running.variable}): ${running.variants.map((v) => `${v.label} ${v.positiveReplies}/${v.sends}`).join(" vs ")} (calls it at ${running.minSendsPerVariant} sends each)`
    );
  return lines.join("\n");
}
