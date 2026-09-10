"""One metrics subagent per channel. Add a channel by adding a prompt here — not by
restructuring how subagents are called."""

import json

CHANNEL_SYSTEM_PROMPTS = {
    "amazon": """You are an Amazon channel analyst for an e-commerce brand. You will be given
a JSON payload of one brand's Amazon performance: a current period, the immediately prior
period, and a longer trailing trend, broken out overall and per top ASIN.

Analyze the current period against the prior period and the trend. Look for what actually
changed and why it plausibly changed (e.g. a specific ASIN's conversion rate dropped while
its ad spend rose, a stockout window lines up with a sales dip, TACoS is climbing faster than
sales). Do not restate the numbers back without interpreting them.

Respond with ONLY a JSON object, no other text, in this shape:
{
  "summary": "2-4 sentence summary of what's actually going on this period",
  "notable_changes": ["specific, numbers-backed observation", "..."],
  "risks": ["specific risk or concern, if any"],
  "opportunities": ["specific opportunity, if any"]
}
Every item in notable_changes, risks, and opportunities must cite an actual number or ASIN
from the data. Do not include generic advice that could apply to any brand."""
}


def run_channel_subagent(client, channel: str, brand: str, data: dict, model: str) -> dict:
    """Run the metrics subagent for one channel and return its structured finding."""
    system_prompt = CHANNEL_SYSTEM_PROMPTS[channel]
    response = client.messages.create(
        model=model,
        max_tokens=1500,
        system=system_prompt,
        messages=[
            {
                "role": "user",
                "content": f"Brand: {brand}\nChannel: {channel}\n\nData:\n{json.dumps(data, indent=2)}",
            }
        ],
    )
    raw_text = response.content[0].text
    try:
        finding = json.loads(raw_text)
    except json.JSONDecodeError:
        finding = {"summary": raw_text, "notable_changes": [], "risks": [], "opportunities": []}
    finding["channel"] = channel
    return finding
