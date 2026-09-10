#!/usr/bin/env python3
"""CLI: load channel data, run the relevant metrics subagent(s), synthesize a recommendation.

Requires ANTHROPIC_API_KEY in the environment (a separate key from any Claude Code login —
see CLAUDE.md). Not needed for test_smoke.py, which stubs the client out.
"""

import argparse
import json
import os
import sys

import anthropic

from subagents import run_channel_subagent
from synthesis import synthesize

DEFAULT_MODEL = "claude-sonnet-5"


def main():
    parser = argparse.ArgumentParser(description="Run the Phase 0 insight pipeline on one brand's data.")
    parser.add_argument("--brand", required=True, help="Brand name, e.g. 'BB-Bands'")
    parser.add_argument("--data-file", required=True, help="Path to a channel data JSON file")
    parser.add_argument("--channel", default="amazon", help="Channel key in CHANNEL_SYSTEM_PROMPTS (default: amazon)")
    parser.add_argument("--model", default=DEFAULT_MODEL, help=f"Model id (default: {DEFAULT_MODEL})")
    args = parser.parse_args()

    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("ANTHROPIC_API_KEY is not set. Export it and re-run (see CLAUDE.md).")

    with open(args.data_file) as f:
        data = json.load(f)

    client = anthropic.Anthropic()

    finding = run_channel_subagent(client, args.channel, args.brand, data, args.model)
    print("--- Subagent finding ---")
    print(json.dumps(finding, indent=2))

    recommendation = synthesize(client, args.brand, [finding], args.model)
    print("\n--- Recommendation ---")
    print(recommendation)


if __name__ == "__main__":
    main()
