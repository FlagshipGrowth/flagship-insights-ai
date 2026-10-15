// The Outbound Sales Engine's lead-scoring model — pure functions, no DB access, so the same
// code scores at ingest and rescores everything when an owner changes the weights.
//
// Each signal produces a 0-1 sub-score from the raw pre-screen facts; the brand's 0-100 score is
// the weighted sum. Unknown facts never count as a gap — missing data scores conservatively
// rather than inflating a brand into a higher tier.
//
// Thresholds marked ASSUMPTION aren't specified in the build plan and are first guesses to be
// revisited after the 10-brand pilot.

export interface ProspectFacts {
  // Listing gaps
  mainImageWeak?: boolean;
  imageCount?: number;
  hasAPlus?: boolean;
  titleWeak?: boolean;
  keywordGaps?: boolean;
  rating?: number;
  reviewCount?: number;
  // Channel gaps — only an explicit `false` counts as missing.
  onWalmart?: boolean;
  onTikTokShop?: boolean;
  // BSR trend: % change in BSR rank number over the last 90 days. Positive = rank number went up
  // = the brand is losing share.
  bsrChange90dPct?: number;
  // True when a stockout, price change, seasonality or suppression explains a falling BSR, so it
  // isn't a conversion-pain signal (the plan says to check this before counting it).
  bsrDropExplained?: boolean;
  // Trigger events in the last 90 days.
  fundingWithin90d?: boolean;
  launchWithin90d?: boolean;
}

export interface ScoringWeights {
  listingGaps: number;
  channelGaps: number;
  bsrTrend: number;
  revenueFit: number;
  triggerEvents: number;
}

export type SignalKey = keyof ScoringWeights;
export type Tier = "A" | "B" | "C";

export const SIGNAL_LABELS: Record<SignalKey, string> = {
  listingGaps: "Listing gaps",
  channelGaps: "Channel gaps",
  bsrTrend: "BSR trend",
  revenueFit: "Revenue fit",
  triggerEvents: "Trigger events",
};

export const SIGNAL_KEYS = Object.keys(SIGNAL_LABELS) as SignalKey[];

/** Eligibility floor from the build plan: roughly $20k+/mo on Amazon or DTC. */
export const MIN_MONTHLY_REVENUE = 20_000;
/** ASSUMPTION: "strong Amazon presence" for the Walmart/TikTok Shop launch track. */
export const LAUNCH_TRACK_MIN_REVENUE = 50_000;

const MIN_GOOD_IMAGE_COUNT = 7; // ASSUMPTION
const MIN_GOOD_RATING = 4.3; // ASSUMPTION
const MIN_GOOD_REVIEW_COUNT = 300; // ASSUMPTION
const BSR_MOVE_PCT = 20; // ASSUMPTION: smaller 90-day moves count as flat

export interface SignalResult {
  subScore: number; // 0-1
  points: number; // subScore * weight, unrounded
  reasons: string[];
}

export interface ScoreResult {
  score: number;
  tier: Tier;
  launchTrack: boolean;
  eligible: boolean;
  ineligibleReason: string | null;
  signals: Record<SignalKey, SignalResult>;
}

export function tierForScore(score: number): Tier {
  if (score >= 80) return "A";
  if (score >= 55) return "B";
  return "C";
}

function listingGaps(f: ProspectFacts): { subScore: number; reasons: string[] } {
  const checks: [boolean, string][] = [
    [f.mainImageWeak === true, "Weak main image"],
    [f.imageCount !== undefined && f.imageCount < MIN_GOOD_IMAGE_COUNT, `Only ${f.imageCount} images`],
    [f.hasAPlus === false, "No A+ content"],
    [f.titleWeak === true, "Weak title"],
    [f.keywordGaps === true, "Keyword gaps"],
    [f.rating !== undefined && f.rating < MIN_GOOD_RATING, `Rating ${f.rating}`],
    [f.reviewCount !== undefined && f.reviewCount < MIN_GOOD_REVIEW_COUNT, `${f.reviewCount} reviews`],
  ];
  const hits = checks.filter(([hit]) => hit).map(([, reason]) => reason);
  return { subScore: hits.length / checks.length, reasons: hits };
}

function channelGaps(f: ProspectFacts): { subScore: number; reasons: string[] } {
  const reasons: string[] = [];
  if (f.onWalmart === false) reasons.push("Not on Walmart");
  if (f.onTikTokShop === false) reasons.push("Not on TikTok Shop");
  return { subScore: reasons.length / 2, reasons };
}

function bsrTrend(f: ProspectFacts): { subScore: number; reasons: string[] } {
  const pct = f.bsrChange90dPct;
  if (pct === undefined) return { subScore: 0, reasons: [] };
  if (pct >= BSR_MOVE_PCT) {
    if (f.bsrDropExplained) return { subScore: 0.2, reasons: [`BSR falling ${pct}% but explained (stock/price/season)`] };
    return { subScore: 1, reasons: [`BSR falling ${pct}% over 90 days`] };
  }
  if (pct <= -BSR_MOVE_PCT) return { subScore: 0.6, reasons: [`BSR rising ${Math.abs(pct)}% (momentum)`] };
  return { subScore: 0.2, reasons: ["BSR flat"] };
}

function revenueFit(revenue: number | null): { subScore: number; reasons: string[] } {
  if (revenue === null) return { subScore: 0, reasons: [] };
  const label = `~$${Math.round(revenue).toLocaleString()}/mo`;
  // ASSUMPTION: $50k-$500k/mo is the sweet spot; the plan doesn't define it.
  if (revenue < MIN_MONTHLY_REVENUE) return { subScore: 0, reasons: [`${label} (below floor)`] };
  if (revenue < 50_000) return { subScore: 0.6, reasons: [label] };
  if (revenue <= 500_000) return { subScore: 1, reasons: [`${label} (sweet spot)`] };
  if (revenue <= 2_000_000) return { subScore: 0.7, reasons: [label] };
  return { subScore: 0.4, reasons: [label] };
}

function triggerEvents(f: ProspectFacts): { subScore: number; reasons: string[] } {
  const reasons: string[] = [];
  if (f.fundingWithin90d) reasons.push("Recent funding");
  if (f.launchWithin90d) reasons.push("Recent product launch");
  return { subScore: f.fundingWithin90d ? 1 : f.launchWithin90d ? 0.7 : 0, reasons };
}

export function scoreProspect(facts: ProspectFacts, estMonthlyRevenue: number | null, weights: ScoringWeights): ScoreResult {
  const raw = {
    listingGaps: listingGaps(facts),
    channelGaps: channelGaps(facts),
    bsrTrend: bsrTrend(facts),
    revenueFit: revenueFit(estMonthlyRevenue),
    triggerEvents: triggerEvents(facts),
  };

  const signals = {} as Record<SignalKey, SignalResult>;
  let total = 0;
  for (const key of SIGNAL_KEYS) {
    const points = raw[key].subScore * weights[key];
    signals[key] = { ...raw[key], points };
    total += points;
  }
  const score = Math.round(total);

  // Unknown revenue isn't disqualifying — sourcing already filtered on it, and a brand with no
  // estimate yet just scores 0 on revenue fit.
  const eligible = estMonthlyRevenue === null || estMonthlyRevenue >= MIN_MONTHLY_REVENUE;
  const launchTrack =
    estMonthlyRevenue !== null &&
    estMonthlyRevenue >= LAUNCH_TRACK_MIN_REVENUE &&
    (facts.onWalmart === false || facts.onTikTokShop === false);

  return {
    score,
    tier: tierForScore(score),
    launchTrack,
    eligible,
    ineligibleReason: eligible ? null : `Estimated revenue below $${MIN_MONTHLY_REVENUE.toLocaleString()}/mo`,
    signals,
  };
}

/** Coerces untrusted JSON (from the ingest API) into ProspectFacts, dropping wrong-typed fields. */
export function parseFacts(input: unknown): ProspectFacts {
  if (!input || typeof input !== "object") return {};
  const o = input as Record<string, unknown>;
  const bool = (k: string) => (typeof o[k] === "boolean" ? (o[k] as boolean) : undefined);
  const num = (k: string) => (typeof o[k] === "number" && Number.isFinite(o[k]) ? (o[k] as number) : undefined);
  const facts: ProspectFacts = {
    mainImageWeak: bool("mainImageWeak"),
    imageCount: num("imageCount"),
    hasAPlus: bool("hasAPlus"),
    titleWeak: bool("titleWeak"),
    keywordGaps: bool("keywordGaps"),
    rating: num("rating"),
    reviewCount: num("reviewCount"),
    onWalmart: bool("onWalmart"),
    onTikTokShop: bool("onTikTokShop"),
    bsrChange90dPct: num("bsrChange90dPct"),
    bsrDropExplained: bool("bsrDropExplained"),
    fundingWithin90d: bool("fundingWithin90d"),
    launchWithin90d: bool("launchWithin90d"),
  };
  // Drop undefined keys so the stored jsonb only holds what was actually known.
  return Object.fromEntries(Object.entries(facts).filter(([, v]) => v !== undefined)) as ProspectFacts;
}
