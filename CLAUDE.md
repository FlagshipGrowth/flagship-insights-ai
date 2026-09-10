# CLAUDE.md — Flagship Insights AI

Read [SPEC.md](SPEC.md) in full before doing anything else in this project. It's the source of truth for scope and open decisions; this file tracks what's actually been decided/built since, which has moved past what SPEC.md's own roadmap originally gated.

## Where things stand (2026-09-10)

- Joey explicitly waived SPEC.md §10's "validate Phase 0 on real data first" gate, then asked to **build out everything (Phase 1-5) except pieces gated on an external platform approval or app registration**, so the app is ready to "hit go" the moment approvals land. Don't re-impose either gate or ask to confirm them again.
- What that means concretely: auth, both portals, the warehouse/sync scaffold, the insights pipeline, and the knowledge-ingestion *architecture* are meant to be genuinely built and working. What stays stubbed is only the actual external calls that need a platform's own approval: Amazon SP-API/Ads, Meta, Google, Walmart, QuickBooks, a Slack app, Google OAuth consent for Gmail, and Fathom API access.
- Phase 0 (`phase0/`) is scaffolded and smoke-tested but was never run against real BB-Bands data — don't treat its recommendation quality as proven. BB-Bands isn't reachable through the Amazon seller analytics connector available in this account (only seller "MAC ENERGY" is bound there).
- Netlify site is live and linked: `flagship-insights-ai` (project id `3a498d1f-2183-4821-b9eb-a64002edb33f`). Uses **Netlify DB** (`@netlify/database`) — schema lives in `netlify/database/migrations/`, applied via `netlify database migrations apply` (or automatically on deploy). Don't recreate a manual `db/schema.sql`-style setup; add new migrations with `netlify database migrations new`.
- Local `netlify database migrations apply` runs against a local PGlite instance, which doesn't ship the `vector` (pgvector) extension — migrations touching `knowledge_chunks` can't be verified locally, only against the real production database on deploy. Say so plainly when that's the case; don't claim a pgvector migration is "verified" from a local run.
- Auth provider is decided: **Clerk** (org-based multi-tenancy maps directly onto client + teammates; internal staff are a separate `INTERNAL_STAFF_EMAILS`-gated path, not a Clerk org). Clerk needs no approval, so it's fully wired, not stubbed.
- Insights pipeline: the phase0 subagent+synthesis *pattern* has been ported to TypeScript (`netlify/functions/lib/insights/`) reading real `metrics_daily` aggregates and writing to the real `insights` table — this is the production implementation, not a copy of the disposable Python.
- Knowledge-ingestion pipeline: chunking/embedding/retrieval (`netlify/functions/lib/knowledge/`) is built using Voyage AI for embeddings (Anthropic has no embeddings API). The actual Slack/Gmail/Fathom pullers are stubs — see `docs/phase4-knowledge-sources.md` for what each needs.

## Hard rules for this project

- **Amazon is the only live channel** in the sync/metrics pipeline. Add other channels (Meta, Google, Walmart, QuickBooks, inventory) as new entries in the relevant `CHANNEL_SYSTEM_PROMPTS`/`CHANNEL_SYNCERS` registries — never a rewrite of the pattern. QuickBooks stays deprioritized until Joey says otherwise.
- **Phase 0's Python (`phase0/`) is disposable** — it proved the pattern; it is not the production implementation. The real implementation is the TypeScript port in `netlify/functions/lib/insights/`. Don't try to make phase0 itself production-ready.
- Don't wire the product's own Slack/Gmail/Fathom ingestion to *this Claude Code session's* interactive MCP connections to those tools — those are Joey's personal integrations, not a server-side OAuth app the deployed product can run unattended. The product needs its own app registrations (docs/phase4-knowledge-sources.md).
- **Running things that call real external APIs** needs their own keys, separate from anything used to build this: `ANTHROPIC_API_KEY` (insights), `VOYAGE_API_KEY` (embeddings), Clerk keys + webhook secret, `CONNECTIONS_ENCRYPTION_KEY`. See `.env.example` for the full list and where each comes from.
- account_manager's "assigned clients only" scoping (SPEC.md §2) isn't implemented — the internal portal currently shows every client to every staff role. Flagged in the UI itself; don't let it quietly become a real access-control gap.

## Layout

```
flagship-insights-ai/
├── SPEC.md / CLAUDE.md
├── docs/
│   ├── phase1-amazon-application.md   # Amazon SP-API/Ads application checklist
│   └── phase4-knowledge-sources.md    # Slack/Gmail/Fathom app-registration checklist
├── middleware.ts                      # Clerk route protection
├── app/                                # Next.js portal (client + internal)
│   ├── dashboard/                      # client view: metrics + latest insight + generate button
│   ├── connections/                    # client view: channel connection status
│   ├── internal/                       # staff-only: all clients/brands
│   ├── sign-in/, sign-up/              # Clerk-hosted auth UI
│   └── api/webhooks/clerk/             # syncs Clerk users/orgs into Postgres
├── lib/                                # Next.js app's own db/metrics/user-context helpers
└── netlify/
    ├── database/migrations/            # schema — apply with `netlify database migrations apply`
    └── functions/
        ├── sync-nightly.ts             # scheduled (@daily), all connections
        ├── sync-on-login-background.ts # on-demand, one brand
        ├── generate-insights-background.ts  # subagent+synthesis → insights table
        └── lib/
            ├── db.ts, crypto.ts, connections.ts, metrics.ts
            ├── channels/amazon.ts       # per-channel metrics syncer registry (stubbed pending approval)
            └── knowledge/               # chunk/embed/retrieve + stubbed source pullers
└── phase0/                             # disposable POC — see "Hard rules" above
```

## Working conventions

- When judging a recommendation's quality, call out whether it's specific to the actual numbers versus generic advice that could apply to any brand.
- Flagship Growth's Meta Ads MCP access (this session's, for Joey's own use) is scoped to ad account `1287113856507273` only — unrelated to this product's own future Meta integration, which is a separate OAuth app entirely.
