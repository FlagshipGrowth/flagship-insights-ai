import type { Tier } from "./outbound-scoring";

// The email sequence. Stops the moment a brand replies. Joey (2026-10-15): 5 emails over 3 weeks,
// email only for now. LinkedIn/Instagram steps can come back later as hand-sent touches; the
// channel types stay so the queue code keeps working when they do.

export type OutboundChannel = "email" | "linkedin" | "instagram";

export interface SequenceStep {
  day: number;
  channel: OutboundChannel | "linkedin_or_instagram";
  kind: string;
  description: string;
}

export const SEQUENCE_STEPS: SequenceStep[] = [
  { day: 1, channel: "email", kind: "audit_hook", description: "The single biggest Amazon listing finding from their audit, why it matters, and the audit link" },
  { day: 4, channel: "email", kind: "value_add", description: "One more useful finding or a quick win they could do themselves this week" },
  { day: 9, channel: "email", kind: "social_proof", description: "A matched client result as context for what fixing this tends to look like, offer the walkthrough" },
  { day: 15, channel: "email", kind: "new_angle", description: "A new angle: a trigger event, or the Walmart / TikTok Shop gap if they aren't on one" },
  { day: 21, channel: "email", kind: "breakup", description: "Short, friendly close: the audit stays theirs to keep either way" },
];

/** Email only for every tier for now (Joey, 2026-10-15). */
export function sequenceForTier(_tier: Tier): SequenceStep[] {
  return SEQUENCE_STEPS;
}

export const TIER_TREATMENT: Record<Tier, string> = {
  A: "Deep Helium10 audit, first in the daily send queue",
  B: "Deep audit, email only",
  C: "Light-touch email using public listing data, no deep audit",
};
