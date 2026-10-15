import { callStructured } from "./claude-structured";
import { proofPromptFor } from "./outbound-proof-bank";
import { sequenceForTier, type SequenceStep } from "./outbound-sequence";
import { AB_VARIABLE_LABELS, type AbVariable } from "./outbound-ab";
import type { AuditFindings } from "./outbound-audit";
import type { Tier } from "./outbound-scoring";

// Writes a prospect's whole sequence in one Claude call, in Joey's voice (rules from the
// flagship-outbound-engine skill). Every message is short, specific to the brand, and only uses
// proof the proof bank allows. Anything the writer can't support with real data it flags with
// [NEEDS JOEY], and those messages always go to review, never straight out.

export const BOOKING_URL = "https://calendly.com/joey-flagshipgrowth/30min";
export const NEEDS_JOEY = "[NEEDS JOEY";

const VOICE = `You write cold outreach for Joey Giazzon, co-founder of Flagship Growth (an agency that runs Amazon, Walmart and TikTok Shop for consumer brands).

Voice: founder to founder. Direct, concise, casual, like Joey typed it himself in Slack. The point of every message is to be genuinely useful: share something specific and insightful about their Amazon listing that they can act on, whether or not they ever talk to us. Informative and helpful, never salesy or pushy. No pressure, no urgency tricks, no "just bumping this", no guilt, no hype words ("skyrocket", "game-changer", "unlock"). No corporate throat-clearing ("I hope this finds you well", "I wanted to reach out"), no buzzwords, no em-dash chains, no exclamation marks, no emojis. One clear, low-key ask per message at most. Plain text only, no markdown, no bullet points.

Hard rules:
- Never invent a number, result, client name, quote or fact. Only use what's in the brand data and the allowed proof below. If a message genuinely needs something you don't have, write [NEEDS JOEY: what's missing] inline.
- Every finding you mention must come from the audit or research data given, and be specific to this brand.
- Write for a founder who isn't an Amazon expert: no jargon (never "BSR", "ASIN", "LQS", "PPC", "A+ module" without saying what it is). Turn numbers into what they mean for sales, e.g. "it's selling at about half its July pace" rather than a rank change.
- Lead with Amazon listing fixes from the audit. Don't pitch a retainer or services. The only ask is a free walkthrough of the audit on a call, offered, never pushed.
- Emails sign off with just "Joey". First email under 90 words; follow-ups under 70; the breakup under 40.
- Every email ends with one short line letting them opt out, like "If it's not relevant, just say so and I'll stop here." Never on LinkedIn or Instagram.
- LinkedIn connection notes are under 280 characters with no pitch and no link. Instagram DMs are casual, under 60 words, about their product or content.`;

export interface CopyInput {
  tier: Tier;
  companyName: string;
  category: string | null;
  estMonthlyRevenue: number | null;
  researchNotes: string | null;
  contactFirstName: string | null;
  contactTitle: string | null;
  personalDetail: string | null;
  launchTrack: boolean;
  auditUrl: string | null;
  auditHeadline: string | null;
  auditFindings: AuditFindings | null;
  facts: Record<string, unknown>;
  // Instruction per A/B variable for the day-1 email (current defaults plus the test variant).
  firstEmailInstructions: Record<AbVariable, string>;
  channels: { email: boolean; linkedin: boolean; instagram: boolean };
}

export interface WrittenTouch {
  day: number;
  channel: SequenceStep["channel"];
  kind: string;
  subject: string | null;
  body: string;
}

function auditDigest(f: AuditFindings): string {
  const parts = [`Summary: ${f.summary}`];
  if (f.keywordGaps.length)
    parts.push(
      `Keyword gaps: ${f.keywordGaps
        .slice(0, 5)
        .map((k) => `"${k.keyword}" (${k.monthlySearchVolume ?? "?"}/mo; ${k.competitorsRanking}; brand ${k.brandRank === null ? "not ranking" : `#${k.brandRank}`})`)
        .join("; ")}`
    );
  for (const [label, fixes] of [
    ["Image stack fixes", f.imageStackFixes],
    ["A+ fixes", f.aPlusFixes],
    ["Ads gaps", f.adsGaps],
  ] as const)
    if (fixes.length) parts.push(`${label}: ${fixes.map((x) => `${x.title} (${x.detail})`).join("; ")}`);
  if (f.mainImageNotes) parts.push(`Main image concept: ${f.mainImageNotes}`);
  if (f.launchOpportunity)
    parts.push(`Launch opportunity (${f.launchOpportunity.channel}): ${f.launchOpportunity.estimate} ${f.launchOpportunity.plan}`);
  return parts.join("\n");
}

export async function writeSequence(input: CopyInput): Promise<WrittenTouch[]> {
  const steps = sequenceForTier(input.tier).filter((s) => {
    if (s.channel === "email") return input.channels.email;
    if (s.channel === "linkedin") return input.channels.linkedin;
    if (s.channel === "instagram") return input.channels.instagram;
    return input.channels.linkedin || input.channels.instagram;
  });
  if (steps.length === 0) return [];

  const brand = [
    `Brand: ${input.companyName}`,
    input.category && `Category: ${input.category}`,
    input.estMonthlyRevenue !== null && `Estimated revenue: ~$${Math.round(input.estMonthlyRevenue).toLocaleString()}/mo`,
    `Recipient: ${input.contactFirstName ?? "(name unknown, use no name)"}${input.contactTitle ? `, ${input.contactTitle}` : ""}`,
    input.personalDetail && `Personal detail about the recipient (use once, lightly): ${input.personalDetail}`,
    input.researchNotes && `Research notes: ${input.researchNotes}`,
    `Verified listing facts: ${JSON.stringify(input.facts)}`,
    input.launchTrack && "They are strong on Amazon but missing Walmart and/or TikTok Shop.",
  ]
    .filter(Boolean)
    .join("\n");

  const audit =
    input.auditFindings && input.auditUrl
      ? `Their audit (link to include in the day 1 email and nowhere else unless it fits): ${input.auditUrl}\nHeadline: ${input.auditHeadline}\n${auditDigest(input.auditFindings)}`
      : "No audit page for this brand (light-touch tier). Base everything on the verified listing facts and research notes; don't mention an audit link.";

  const firstEmail = (Object.keys(input.firstEmailInstructions) as AbVariable[])
    .map((k) => `- ${AB_VARIABLE_LABELS[k]}: ${input.firstEmailInstructions[k]}`)
    .join("\n");

  const plan = steps.map((s) => `- Day ${s.day}, ${s.channel}, "${s.kind}": ${s.description}`).join("\n");

  const result = await callStructured<{ touches: { day: number; subject: string | null; body: string }[] }>({
    system: VOICE,
    prompt: `${brand}\n\n${audit}\n\n${proofPromptFor(input.category)}\n\nBooking link for the call: ${BOOKING_URL}\n\nWrite every message in this sequence, one per line of the plan, in order:\n${plan}\n\nFor the day 1 email follow these instructions exactly:\n${firstEmail}\n\nAll emails are one thread: only the day 1 email gets a subject; the rest have subject null. Each follow-up must add something new rather than repeat the last message. LinkedIn and Instagram messages have subject null.`,
    toolName: "write_sequence",
    toolDescription: "Return every message of the sequence, in plan order.",
    schema: {
      type: "object",
      properties: {
        touches: {
          type: "array",
          items: {
            type: "object",
            properties: {
              day: { type: "integer" },
              subject: { type: ["string", "null"] },
              body: { type: "string" },
            },
            required: ["day", "subject", "body"],
            additionalProperties: false,
          },
        },
      },
      required: ["touches"],
      additionalProperties: false,
    },
  });

  const byDay = new Map(result.touches.map((t) => [t.day, t]));
  return steps.flatMap((s) => {
    const t = byDay.get(s.day);
    if (!t?.body?.trim()) return [];
    return [{ day: s.day, channel: s.channel, kind: s.kind, subject: s.channel === "email" ? t.subject?.trim() || null : null, body: t.body.trim() }];
  });
}
