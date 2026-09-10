// TypeScript port of phase0/synthesis.py — same rules, real usage.
import type Anthropic from "@anthropic-ai/sdk";
import type { Finding } from "./subagents";

const SYNTHESIS_SYSTEM_PROMPT = `You are the synthesis agent for a brand performance insights
tool. You are given one or more per-channel analyst findings (as JSON) for a single brand and
period. Turn them into ONE actionable recommendation for the brand owner.

Rules:
- Be specific: reference the actual numbers or changes named in the findings.
- Prioritize: lead with what matters most this period, not a laundry list.
- Recommend an action, not just an observation.
- No generic filler unless it's the specific, data-justified next step.
- 3-6 sentences. Plain prose, not bullet points.`;

export async function synthesize(
  client: Anthropic,
  brand: string,
  findings: Finding[],
  model: string
): Promise<string> {
  const response = await client.messages.create({
    model,
    max_tokens: 600,
    system: SYNTHESIS_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Brand: ${brand}\n\nChannel findings:\n${JSON.stringify(findings, null, 2)}`,
      },
    ],
  });
  const block = response.content[0];
  return block.type === "text" ? block.text : "";
}
