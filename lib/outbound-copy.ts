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

// Joey (2026-10-15): one signature on every email, plain text with no links or images, which
// delivers best from cold inboxes. Added here, not by the writer, so it's identical everywhere:
// previews, the review queue, test emails and what Instantly sends.
export const EMAIL_SIGNATURE = "Joey Giazzon\nCo-Founder, Flagship Growth";

/** Drops any sign-off the writer added anyway, then appends the fixed signature. */
export function withSignature(body: string): string {
  const lines = body.trim().split(/\r?\n/);
  while (lines.length > 1 && /^\s*(-+\s*)?(joey( giazzon)?|best|thanks|cheers|talk soon|best regards|regards)[,.]?\s*$/i.test(lines[lines.length - 1])) {
    lines.pop();
  }
  return `${lines.join("\n").trim()}\n\n${EMAIL_SIGNATURE}`;
}

/** For bodies written before the signature existed (or edited in review): add it if missing. */
export function ensureSignature(body: string): string {
  return body.trim().endsWith(EMAIL_SIGNATURE) ? body.trim() : withSignature(body);
}

/** Cold emails carry no links (Joey, 2026-10-16: links hurt delivery). Removes any URL the writer
 * or an older draft left in, plus a line it leaves empty. */
export function stripLinks(body: string): string {
  const url = /\(?\s*(https?:\/\/|www\.)\S+\s*\)?/gi;
  return body
    .split(/\r?\n/)
    .flatMap((line) => {
      if (!url.test(line)) return [line];
      url.lastIndex = 0;
      const cleaned = line.replace(url, "").replace(/\s+([.,:;])/g, "$1").trimEnd();
      // "Full audit here:" with its link gone is just noise.
      return cleaned.trim() === "" || /:\s*$/.test(cleaned) ? [] : [cleaned];
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** What actually goes out: no links, the fixed signature. */
export function finalEmailBody(body: string): string {
  return ensureSignature(stripLinks(body));
}

// Facts about Flagship the writer may use, all from Joey's overview deck / flagshipgrowth.com.
const COMPANY_FACTS = `Company facts you may use (nothing else about Flagship):
- Flagship Growth runs Amazon, Walmart and TikTok Shop for consumer brands, with one team covering creative, ads, catalog, listings and inventory.
- $650M+ in sales generated for brand partners; 200+ brand partners; 30+ years of combined marketplace experience.
- Amazon SPN Verified Partner and TikTok Shop Certified Agency.`;

const VOICE = `You write cold outreach for Joey Giazzon, co-founder of Flagship Growth (an agency that runs Amazon, Walmart and TikTok Shop for consumer brands).

Voice: founder to founder, warm and human, like Joey wrote it himself. The point of every message is to be genuinely useful: share specific, insightful findings about their Amazon listing that they can act on, whether or not they ever talk to us. Informative and helpful, never salesy or pushy. No pressure, no urgency tricks, no "just bumping this", no guilt, no hype words ("skyrocket", "game-changer", "unlock"). No corporate throat-clearing ("I hope this finds you well", "I wanted to reach out"), no buzzwords, no em-dash chains, no emojis. Plain text only, no markdown or bold.

Shape of every email (Joey, 2026-10-16):
- Start with a friendly greeting on its own line: "Hey <first name>," or "Hey there," when there's no name. This overrides any opener instruction below.
- Day 1 email, in this order:
  1. One line saying who Joey is: co-founder of Flagship Growth, and what Flagship does (runs Amazon, Walmart and TikTok Shop for consumer brands).
  2. One line saying we went through their Amazon listing and a few things stood out.
  3. 2-3 specific callouts from their audit, each on its own line starting with "- ". Each callout names what we saw and what it's costing them, in plain words.
  4. One line of credibility about the team, using only the company facts and allowed proof given below.
  5. The ask, then the opt-out line.
  Keep it to 110-170 words.
- Follow-ups: a greeting, then one new thing each time. Use a different audit callout not used before, a relevant result from the allowed proof, or a short note on how the team works (one team covering Amazon, Walmart and TikTok Shop; creative, ads, catalog and inventory under one roof). 50-90 words. The breakup email is under 50 words.

Hard rules:
- Never invent a number, result, client name, quote or fact. Only use what's in the brand data and the allowed proof below. If a message genuinely needs something you don't have, write [NEEDS JOEY: what's missing] inline.
- Every finding you mention must come from the audit or research data given, and be specific to this brand.
- Write for a founder who isn't an Amazon expert: no jargon (never "BSR", "ASIN", "LQS", "PPC", "A+ module" without saying what it is). Turn numbers into what they mean for sales, e.g. "it's selling at about half its July pace" rather than a rank change.
- Lead with Amazon listing fixes from the audit. Don't pitch a retainer or services. The ask is to reply: offer to send the full audit (a few more fixes like this one) and, with no pressure, a free walkthrough call.
- No links or URLs anywhere in an email, ever: not the audit, not a booking link, not a website. Links in cold email hurt delivery. Joey sends the audit link himself when they reply. This rule overrides any instruction below that mentions a link.
- Each email gives real value in its own words: name the specific finding, say what it's costing them in plain terms, and say what the fix is. The reader should learn something even if they never reply.
- Emails have no sign-off and no signature: don't write "Joey", "Best" or a name at the end. The same signature is added to every email automatically.
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
  if (f.opportunities.length)
    parts.push(
      `Top opportunities (best callouts, already in plain English):\n${f.opportunities
        .map((o) => `- ${o.title}: saw ${o.whatWeSaw}; matters because ${o.whyItMatters}; fix: ${o.theFix}`)
        .join("\n")}`
    );
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
    ["What reviews say", f.reviewInsights],
    ["Pricing vs competitors", f.pricingNotes],
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
      ? `We've written them a full audit (don't include its link; offer to send it if they reply).\nHeadline: ${input.auditHeadline}\n${auditDigest(input.auditFindings)}`
      : "No audit page for this brand (light-touch tier). Base everything on the verified listing facts and research notes; don't offer an audit.";

  const firstEmail = (Object.keys(input.firstEmailInstructions) as AbVariable[])
    .map((k) => `- ${AB_VARIABLE_LABELS[k]}: ${input.firstEmailInstructions[k]}`)
    .join("\n");

  const plan = steps.map((s) => `- Day ${s.day}, ${s.channel}, "${s.kind}": ${s.description}`).join("\n");

  const result = await callStructured<{ touches: { day: number; subject: string | null; body: string }[] }>({
    system: VOICE,
    prompt: `${brand}\n\n${audit}\n\n${proofPromptFor(input.category)}\n\n${COMPANY_FACTS}\n\nWrite every message in this sequence, one per line of the plan, in order:\n${plan}\n\nFor the day 1 email, apply these within the required shape (greeting first, 2-3 callouts, no links):\n${firstEmail}\n\nAll emails are one thread: only the day 1 email gets a subject; the rest have subject null. Each follow-up must add something new rather than repeat the last message. LinkedIn and Instagram messages have subject null.`,
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
    return [{ day: s.day, channel: s.channel, kind: s.kind, subject: s.channel === "email" ? t.subject?.trim() || null : null, body: s.channel === "email" ? withSignature(stripLinks(t.body)) : t.body.trim() }];
  });
}
