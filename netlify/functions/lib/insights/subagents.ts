// TypeScript port of phase0/subagents.py's pattern, adapted to read real metrics_daily
// aggregates instead of a sample JSON file. Phase 0's Python was explicitly disposable
// (CLAUDE.md) — this is the real implementation, but the prompt design carries over.
import type Anthropic from "@anthropic-ai/sdk";

export const CHANNEL_SYSTEM_PROMPTS: Record<string, string> = {
  amazon: `You are an Amazon channel analyst for an e-commerce brand. You will be given a JSON
payload of one brand's Amazon performance: a current ~30-day period and the immediately prior
~30-day period, both as metric totals.

Analyze the current period against the prior period. Look for what actually changed and why it
plausibly changed. Do not restate the numbers back without interpreting them.

Respond with ONLY a JSON object, no other text, in this shape:
{
  "summary": "2-4 sentence summary of what's actually going on this period",
  "notable_changes": ["specific, numbers-backed observation", "..."],
  "risks": ["specific risk or concern, if any"],
  "opportunities": ["specific opportunity, if any"]
}
Every item must cite an actual number from the data. No generic advice that could apply to any
brand.`,
};

export interface Finding {
  channel: string;
  summary: string;
  notable_changes: string[];
  risks: string[];
  opportunities: string[];
}

export async function runChannelSubagent(
  client: Anthropic,
  channel: string,
  brand: string,
  data: unknown,
  model: string
): Promise<Finding> {
  const systemPrompt = CHANNEL_SYSTEM_PROMPTS[channel];
  if (!systemPrompt) {
    throw new Error(`No CHANNEL_SYSTEM_PROMPTS entry for channel "${channel}"`);
  }

  const response = await client.messages.create({
    model,
    max_tokens: 1500,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Brand: ${brand}\nChannel: ${channel}\n\nData:\n${JSON.stringify(data, null, 2)}`,
      },
    ],
  });

  const block = response.content[0];
  const rawText = block.type === "text" ? block.text : "";

  let finding: Partial<Finding>;
  try {
    finding = JSON.parse(rawText);
  } catch {
    finding = { summary: rawText, notable_changes: [], risks: [], opportunities: [] };
  }

  return {
    channel,
    summary: finding.summary ?? "",
    notable_changes: finding.notable_changes ?? [],
    risks: finding.risks ?? [],
    opportunities: finding.opportunities ?? [],
  };
}
