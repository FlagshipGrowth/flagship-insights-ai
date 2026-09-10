"""Combines per-channel subagent findings into one recommendation. Today there's only ever
one finding (Amazon); this still goes through synthesis so the pattern holds once more
channels and the house/client knowledge tiers are added."""

import json

SYNTHESIS_SYSTEM_PROMPT = """You are the synthesis agent for a brand performance insights tool.
You are given one or more per-channel analyst findings (as JSON) for a single brand and period.
Your job is to turn them into ONE actionable recommendation for the brand owner.

Rules:
- Be specific: reference the actual numbers, ASINs, or changes named in the findings.
- Prioritize: if there are multiple observations, lead with the one that matters most this
  period, not a laundry list.
- Recommend an action, not just an observation. Say what to do and why the data supports it.
- No generic filler ("keep monitoring performance", "continue optimizing listings") unless
  it's the specific, data-justified next step.
- 3-6 sentences. Plain prose, not bullet points.
"""


def synthesize(client, brand: str, findings: list, model: str) -> str:
    """Turn a list of channel findings into a single recommendation string."""
    response = client.messages.create(
        model=model,
        max_tokens=600,
        system=SYNTHESIS_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f"Brand: {brand}\n\nChannel findings:\n{json.dumps(findings, indent=2)}",
            }
        ],
    )
    return response.content[0].text
