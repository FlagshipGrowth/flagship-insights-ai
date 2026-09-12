import Anthropic from "@anthropic-ai/sdk";

export interface ParsedTask {
  title: string;
  brandName: string | null;
  priority: "low" | "med" | "high" | null;
}

const NLU_MODEL = "claude-haiku-4-5-20251001"; // fast/cheap — this is a small extraction task, not analysis

const EXTRACT_TOOL: Anthropic.Tool = {
  name: "extract_task",
  description: "Extract a task title, the brand it's for (if named), and its priority from a Slack message.",
  input_schema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "A concise, imperative task title with any brand name/priority wording removed.",
      },
      brandName: {
        type: ["string", "null"],
        description: "The brand name mentioned, copied EXACTLY as it appears in the given list — or null if none is named.",
      },
      priority: {
        type: ["string", "null"],
        enum: ["low", "med", "high", null],
        description: "Only set if the message clearly signals urgency (e.g. 'urgent', 'low priority', 'ASAP').",
      },
    },
    required: ["title", "brandName", "priority"],
  },
};

/**
 * `/create-task <title> | client:<brand> | priority:<...>` is parsed deterministically — no LLM
 * call, so it stays fast and free. Plain conversational text (no `|`) goes to Claude instead, so
 * staff can just type e.g. "opopop needs seo copy redone, this is urgent" and get the same result.
 */
export async function parseTaskText(rawText: string, brandNames: string[]): Promise<ParsedTask> {
  if (rawText.includes("|")) {
    const [title, ...modifiers] = rawText.split("|").map((s) => s.trim());
    const fields: Record<string, string> = {};
    for (const mod of modifiers) {
      const [key, value] = mod.split(":").map((s) => s.trim());
      if (key && value) fields[key.toLowerCase()] = value;
    }
    const priority = fields.priority?.toLowerCase();
    return {
      title,
      brandName: fields.client ?? null,
      priority: priority === "low" || priority === "med" || priority === "high" ? priority : null,
    };
  }

  const client = new Anthropic();
  const response = await client.messages.create({
    model: NLU_MODEL,
    max_tokens: 300,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "tool", name: "extract_task" },
    messages: [
      {
        role: "user",
        content: `Valid brand names: ${JSON.stringify(brandNames)}\n\nSlack message: "${rawText}"`,
      },
    ],
  });

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  const input = (toolUse?.input ?? {}) as Partial<ParsedTask>;
  return {
    title: input.title?.trim() || rawText,
    brandName: input.brandName ?? null,
    priority: input.priority ?? null,
  };
}
