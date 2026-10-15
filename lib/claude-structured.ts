import Anthropic from "@anthropic-ai/sdk";

// One structured Claude call for the outbound engine (sequence copy, reply triage, A/B challengers).
//
// Claude Opus 5.5 rejects forced tool_choice ("any"/"tool"), so the tool is declared `strict: true`
// (schema-valid input guaranteed) with tool_choice "auto" and an instruction to call it. The
// installed SDK (0.32) predates `strict`, `thinking` and `fallbacks`, so those go through as plain
// body fields; the SDK sends unknown fields as-is.
//
// `fallbacks: "default"` (beta server-side-fallback-2026-07-01) re-routes a request that a safety
// classifier declines to a fallback model instead of failing the run.

export const OUTBOUND_MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  client ??= new Anthropic();
  return client;
}

export interface StructuredCall {
  system: string;
  prompt: string;
  toolName: string;
  toolDescription: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
}

export async function callStructured<T>(call: StructuredCall): Promise<T> {
  const body = {
    model: OUTBOUND_MODEL,
    max_tokens: call.maxTokens ?? 16000,
    system: call.system,
    messages: [
      {
        role: "user",
        content: `${call.prompt}\n\nRespond by calling the ${call.toolName} tool exactly once.`,
      },
    ],
    tools: [
      {
        name: call.toolName,
        description: call.toolDescription,
        strict: true,
        input_schema: call.schema,
      },
    ],
    tool_choice: { type: "auto" },
    output_config: { effort: call.effort ?? "medium" },
    fallbacks: "default",
  };

  const response = (await getClient().messages.create(body as unknown as Anthropic.MessageCreateParamsNonStreaming, {
    headers: { "anthropic-beta": "server-side-fallback-2026-07-01" },
  })) as Anthropic.Message;

  if ((response.stop_reason as string) === "refusal") {
    throw new Error(`Claude declined the ${call.toolName} request`);
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error(`Claude ran out of tokens before finishing ${call.toolName}`);
  }
  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === call.toolName
  );
  if (!toolUse) throw new Error(`Claude did not call ${call.toolName}`);
  return toolUse.input as T;
}
