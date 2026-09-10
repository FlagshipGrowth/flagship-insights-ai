# CLAUDE.md — Flagship Insights AI

Read [SPEC.md](SPEC.md) in full before doing anything else in this project. It's the source of truth for scope, roadmap, and open decisions.

## Where things stand

- **2026-09-10: Joey explicitly waived the "validate Phase 0 on real data first" gate** and asked to move straight into building Phase 1+ rather than wait on a real BB-Bands export. Phase 0 (`phase0/`) is scaffolded and smoke-tested but never run against real numbers — don't treat its recommendation quality as proven.
- BB-Bands isn't reachable through the Amazon seller analytics connector available in this account (only seller "MAC ENERGY" is bound there) — a real export would need to come from Joey directly if Phase 0 validation comes back into scope later.
- Phase 1 (Amazon platform application) and Phase 2 (warehouse + sync scaffold) are now in progress — see the repo root for the Netlify/Postgres scaffold and `docs/phase1-amazon-application.md`.

## Hard rules for this project

- The original SPEC.md §10 gate ("nothing else starts until Phase 0 is validated") was intentionally overridden by Joey — don't reflexively re-impose it or ask to confirm it again.
- Auth provider, the client/internal portal UI, and the knowledge-ingestion pipeline (Slack/Gmail/Fathom/docs, house vs. client tiers) are still genuinely not started (Phase 3-5). Building the warehouse/sync scaffold (Phase 2) and filing the Amazon application (Phase 1) does not mean jumping to those — confirm before starting Phase 3+.
- **Amazon is the only live channel.** Add other channels (Meta, Google, Walmart, QuickBooks, inventory) only as new entries in `phase0/subagents.py`'s `CHANNEL_SYSTEM_PROMPTS` — never a rewrite of the pattern. QuickBooks stays deprioritized until Joey says otherwise.
- **Phase 0 code is disposable.** It exists to prove the subagent + synthesis pattern, not to become the production implementation. Don't over-engineer it — no premature abstractions, no error handling for cases that can't happen here.
- **Claude Agent SDK is the long-term AI layer**, not ad hoc API calls — keep that in mind when the pattern gets carried into later phases, but Phase 0 itself can stay simple.
- **Running `run_insight.py` for real** requires its own `ANTHROPIC_API_KEY` (separate from the Claude Code login used to build this). `test_smoke.py` uses a stubbed client and needs no key.

## Layout

```
flagship-insights-ai/
├── SPEC.md                       # full project brief — read first
├── CLAUDE.md                     # this file
└── phase0/
    ├── subagents.py               # one metrics subagent per channel (CHANNEL_SYSTEM_PROMPTS)
    ├── synthesis.py                # combines subagent findings into one recommendation
    ├── run_insight.py              # CLI: load data → run subagent(s) → synthesize → print
    ├── test_smoke.py               # stubbed-client test, no API key needed
    ├── requirements.txt
    └── sample_data/
        └── bb_bands_amazon.json    # placeholder BB-Bands Amazon data — swap for real numbers
```

## Working conventions

- Keep responses and code changes scoped to Phase 0 unless explicitly told to move on.
- When judging a recommendation's quality, call out whether it's specific to the actual numbers (SKU-level, period-over-period, causally linked) versus generic advice that could apply to any brand.
- Flagship Growth's Meta Ads MCP access is scoped to ad account `1287113856507273` only — see the user's global memory. Not relevant to Phase 0 (Amazon-only) but applies once Meta is added.
