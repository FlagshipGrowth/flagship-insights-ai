import type { Tier } from "./outbound-scoring";

// The ~4-week multi-channel sequence from the build plan. Stops the moment a brand replies on any
// channel. Email goes out from the engine; LinkedIn/Instagram are queued for a person to send by
// hand from Joey's real accounts, since automated sending violates those platforms' terms.

export type OutboundChannel = "email" | "linkedin" | "instagram";

export interface SequenceStep {
  day: number;
  channel: OutboundChannel | "linkedin_or_instagram";
  kind: string;
  description: string;
}

export const SEQUENCE_STEPS: SequenceStep[] = [
  { day: 1, channel: "email", kind: "audit_hook", description: "Audit hook: the biggest listing finding, one line of credibility, link to the audit" },
  { day: 2, channel: "linkedin", kind: "connection", description: "Connection request with a short personalized note, no pitch" },
  { day: 4, channel: "email", kind: "value_add", description: "Value add: two more findings or a quick win" },
  { day: 6, channel: "instagram", kind: "dm", description: "Casual DM about their product or content with the free audit offer" },
  { day: 8, channel: "linkedin", kind: "audit_message", description: "If connected, short message referencing the audit" },
  { day: 10, channel: "email", kind: "social_proof", description: "Social proof: client result matched to their category, ask for a call" },
  { day: 17, channel: "email", kind: "new_angle", description: "New angle: trigger event, Walmart / TikTok Shop opportunity, or why now" },
  { day: 20, channel: "linkedin_or_instagram", kind: "light_follow_up", description: "Light follow-up on whichever channel they engaged with" },
  { day: 26, channel: "email", kind: "breakup", description: "Breakup note" },
];

/** Tier A runs all three channels; B and C are email only (C with a light-touch audit). */
export function sequenceForTier(tier: Tier): SequenceStep[] {
  if (tier === "A") return SEQUENCE_STEPS;
  return SEQUENCE_STEPS.filter((s) => s.channel === "email");
}

export const TIER_TREATMENT: Record<Tier, string> = {
  A: "Deep Helium10 audit, all three channels, first in the daily send queue",
  B: "Deep audit, email only",
  C: "Light-touch email using public listing data, no deep audit",
};
