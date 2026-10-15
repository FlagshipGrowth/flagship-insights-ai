import { getDb } from "./db";
import { callStructured } from "./claude-structured";

// Always-on A/B testing of the day-1 email (build plan, phase 4): one variable at a time, about 200
// sends per variant, winner judged on positive (interested) replies, never opens. The winner
// becomes the default for that variable, Claude writes a new challenger, and the next test starts.
//
// A variant's `content` is an instruction to the copy writer ("subject line: a question about their
// category"), not literal copy, so every brand still gets personalized text.

export const AB_VARIABLES = ["subject", "opener", "cta", "audit_hook"] as const;
export type AbVariable = (typeof AB_VARIABLES)[number];

export const AB_VARIABLE_LABELS: Record<AbVariable, string> = {
  subject: "Subject line",
  opener: "Opening line",
  cta: "Call to action",
  audit_hook: "Audit hook",
};

const STARTING_DEFAULTS: Record<AbVariable, string> = {
  subject: "Subject: 3-6 lowercase words naming their brand and the single biggest audit finding.",
  opener: "Open with the single most specific finding from their audit, no greeting fluff.",
  cta: "Close by sharing the full audit link and offering, with no pressure, a free 20-minute walkthrough.",
  audit_hook: "Lead with the single biggest, most specific Amazon listing finding from their audit headline, with its number.",
};

const STARTING_CHALLENGERS: Record<AbVariable, string> = {
  subject: "Subject: a short question about their category or competitor, without their brand name.",
  opener: "Open with one sentence about something specific and recent at their brand, then the finding.",
  cta: "Close with a yes/no question: should I send over what we'd fix first?",
  audit_hook: "Lead with the main image: what today's image loses versus the top competitor's.",
};

export interface AbVariant {
  id: string;
  label: string;
  content: string;
  isControl: boolean;
}

export interface RunningTest {
  id: string;
  variable: AbVariable;
  minSendsPerVariant: number;
  variants: AbVariant[];
}

async function loadTest(testId: string): Promise<RunningTest | null> {
  const sql = getDb();
  const [t] = await sql`select id, variable, min_sends_per_variant from outbound_ab_tests where id = ${testId}`;
  if (!t) return null;
  const variants = await sql`
    select id, label, content, is_control from outbound_ab_variants where test_id = ${testId} order by is_control desc, created_at
  `;
  return {
    id: t.id,
    variable: t.variable,
    minSendsPerVariant: t.min_sends_per_variant,
    variants: variants.map((v: any) => ({ id: v.id, label: v.label, content: v.content, isControl: v.is_control })),
  };
}

/** What the copy writer uses for each variable when no test variant applies: the latest winner,
 * else the starting default. */
export async function getCurrentDefaults(): Promise<Record<AbVariable, string>> {
  const sql = getDb();
  const rows = await sql`
    select distinct on (t.variable) t.variable, v.content
    from outbound_ab_tests t join outbound_ab_variants v on v.id = t.winner_variant_id
    where t.status = 'concluded'
    order by t.variable, t.concluded_at desc
  `;
  const out = { ...STARTING_DEFAULTS };
  for (const r of rows as any[]) out[r.variable as AbVariable] = r.content;
  return out;
}

async function writeChallenger(variable: AbVariable, current: string, history: string[]): Promise<string> {
  const result = await callStructured<{ instruction: string }>({
    system:
      "You design A/B tests for cold outbound email from Flagship Growth, an agency that runs Amazon, Walmart and TikTok Shop for CPG brands. Emails are founder-to-founder, short and specific.",
    prompt: `Write one challenger instruction for the "${AB_VARIABLE_LABELS[variable]}" of the first cold email.\n\nCurrent default (the one to beat): ${current}\n\nAlready tested before:\n${history.map((h) => `- ${h}`).join("\n") || "- nothing yet"}\n\nThe instruction tells a copywriter what to do for every brand; it must not contain brand-specific text. Make it meaningfully different from the default and from past tests, and something that could plausibly earn more interested replies while staying helpful and never salesy or pushy. One sentence.`,
    toolName: "propose_challenger",
    toolDescription: "Return the challenger instruction.",
    schema: {
      type: "object",
      properties: { instruction: { type: "string" } },
      required: ["instruction"],
      additionalProperties: false,
    },
    maxTokens: 4000,
    effort: "low",
  });
  return result.instruction.trim();
}

/** Returns the running test, starting the next one if none is running. Variables rotate: the one
 * tested longest ago (or never) goes next. */
export async function ensureRunningTest(): Promise<RunningTest> {
  const sql = getDb();
  const [running] = await sql`select id from outbound_ab_tests where status = 'running' order by started_at limit 1`;
  if (running) return (await loadTest(running.id))!;

  const last = await sql`select variable, max(started_at) as at from outbound_ab_tests group by variable`;
  const lastRun = new Map((last as any[]).map((r) => [r.variable as AbVariable, new Date(r.at).getTime()]));
  const variable = [...AB_VARIABLES].sort((a, b) => (lastRun.get(a) ?? 0) - (lastRun.get(b) ?? 0))[0];

  const defaults = await getCurrentDefaults();
  const tested = await sql`
    select v.content from outbound_ab_variants v join outbound_ab_tests t on t.id = v.test_id where t.variable = ${variable}
  `;
  const history = (tested as any[]).map((r) => r.content as string);
  const challenger = history.length === 0 ? STARTING_CHALLENGERS[variable] : await writeChallenger(variable, defaults[variable], history);

  const [test] = await sql`insert into outbound_ab_tests (variable, channel, step_day) values (${variable}, 'email', 1) returning id`;
  await sql`
    insert into outbound_ab_variants (test_id, label, content, is_control) values
      (${test.id}, 'A (default)', ${defaults[variable]}, true),
      (${test.id}, 'B (challenger)', ${challenger}, false)
  `;
  return (await loadTest(test.id))!;
}

/** The variant with the fewest day-1 touches so far, so variants fill evenly. */
export async function pickVariant(test: RunningTest): Promise<AbVariant> {
  const sql = getDb();
  const counts = await sql`
    select variant_id, count(*)::int as n from outbound_touches
    where variant_id = any(${test.variants.map((v) => v.id)}::uuid[]) and status <> 'cancelled'
    group by variant_id
  `;
  const byId = new Map((counts as any[]).map((r) => [r.variant_id, r.n as number]));
  return [...test.variants].sort((a, b) => (byId.get(a.id) ?? 0) - (byId.get(b.id) ?? 0))[0];
}

export interface VariantResult {
  id: string;
  label: string;
  content: string;
  isControl: boolean;
  sends: number;
  positiveReplies: number;
  positiveRate: number | null;
}

export async function getVariantResults(testId: string): Promise<VariantResult[]> {
  const sql = getDb();
  const rows = await sql`
    select v.id, v.label, v.content, v.is_control,
           count(distinct t.id) filter (where t.status = 'sent')::int as sends,
           count(distinct r.prospect_id) filter (where r.classification = 'interested')::int as positives
    from outbound_ab_variants v
    left join outbound_touches t on t.variant_id = v.id
    left join outbound_replies r on r.prospect_id = t.prospect_id and t.status = 'sent'
    where v.test_id = ${testId}
    group by v.id
    order by v.is_control desc, v.created_at
  `;
  return (rows as any[]).map((r) => ({
    id: r.id,
    label: r.label,
    content: r.content,
    isControl: r.is_control,
    sends: r.sends,
    positiveReplies: r.positives,
    positiveRate: r.sends > 0 ? r.positives / r.sends : null,
  }));
}

/** Concludes the running test once every variant has its minimum sends. A tie keeps the control. */
export async function evaluateRunningTest(): Promise<{ concluded: boolean; winner?: string }> {
  const sql = getDb();
  const [running] = await sql`select id, min_sends_per_variant from outbound_ab_tests where status = 'running' limit 1`;
  if (!running) return { concluded: false };
  const results = await getVariantResults(running.id);
  if (results.length === 0 || results.some((r) => r.sends < running.min_sends_per_variant)) return { concluded: false };

  const control = results.find((r) => r.isControl) ?? results[0];
  const winner = results.reduce((best, r) => ((r.positiveRate ?? 0) > (best.positiveRate ?? 0) ? r : best), control);
  const summary = results.map((r) => `${r.label}: ${r.positiveReplies}/${r.sends} interested`).join("; ");
  await sql`
    update outbound_ab_tests
    set status = 'concluded', winner_variant_id = ${winner.id}, concluded_at = now(), notes = ${summary}
    where id = ${running.id}
  `;
  return { concluded: true, winner: winner.label };
}

export interface TestSummary {
  id: string;
  variable: AbVariable;
  status: "running" | "concluded";
  startedAt: string;
  concludedAt: string | null;
  notes: string | null;
  winnerVariantId: string | null;
  minSendsPerVariant: number;
  variants: VariantResult[];
}

export async function getRecentTests(limit = 6): Promise<TestSummary[]> {
  const sql = getDb();
  const tests = await sql`
    select id, variable, status, started_at, concluded_at, notes, winner_variant_id, min_sends_per_variant
    from outbound_ab_tests order by started_at desc limit ${limit}
  `;
  return Promise.all(
    (tests as any[]).map(async (t) => ({
      id: t.id,
      variable: t.variable,
      status: t.status,
      startedAt: new Date(t.started_at).toISOString(),
      concludedAt: t.concluded_at ? new Date(t.concluded_at).toISOString() : null,
      notes: t.notes,
      winnerVariantId: t.winner_variant_id,
      minSendsPerVariant: t.min_sends_per_variant,
      variants: await getVariantResults(t.id),
    }))
  );
}
