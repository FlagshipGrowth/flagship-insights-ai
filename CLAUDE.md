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
- Catalog (product spec data per brand): Joey was explicit this must be a **live, refreshable sync from each brand's Google Sheet master spec sheet — never a one-time download/export/scrape**. Migration `0010_add-products-table-and-brand-sheet-refs` (deployed 2026-09-11) adds the `products` table and `brands.google_sheet_id`/`google_sheet_specs_gid` (real IDs extracted from the "Amazon reporting files" tracker, one per brand — see migration file for the full list). Verified 2026-09-11: Jax Athletics and Noggin Boss both looked ambiguous (their sheet's bare `/edit` URL opens on a different last-viewed tab), but their real "Specs" tab is confirmed at `gid=0` in both cases, matching the migration — no fix needed.
- **Google Cloud service account is live**: project `amazon-weekly-reports`, service account `flagship-insights-sheets-sync@amazon-weekly-reports.iam.gserviceaccount.com`. Sheets API enabled. `GOOGLE_SHEETS_CLIENT_EMAIL` and `GOOGLE_SHEETS_PRIVATE_KEY` are set in Netlify env (production + dev). All 23 brand master spec sheets have been shared with that service account as Viewer (2026-09-11). Don't build any CSV-export/scrape-based version of this — that was explicitly rejected.
- **Catalog sync connector is built and verified in production** (`netlify/functions/lib/catalog/google-sheets.ts`, wired up as the daily-scheduled `netlify/functions/catalog-sync.ts`): hand-rolled JWT auth (no google-auth-library needed for one API), reads each brand's Specs tab, maps columns by header *text* (not position — every brand's sheet was built independently, e.g. "UPC" vs "EAN Number" vs "ISBN"), and upserts into `products` keyed on `(brand_id, asin)`. Also captures a `sku` column (brands' own SKU codes, distinct from ASIN — what the Catalog UI and margin calculator's product picker key off of). A run also deletes any product row it didn't just touch, so removed products (or a brand that was pointed at the wrong sheet entirely) don't linger. As of 2026-09-11: 21 of 23 brands have real product data; **Noggin Boss's Specs tab is genuinely empty** (header row only, no product rows yet — not a bug); **WINK's `google_sheet_id` needs correcting** — the linked spreadsheet has no real Specs-style tab at all, only a raw Amazon bulk-upload template ("RAW DATA" tab), so WINK syncs zero products until Joey points it at the actual master spec sheet.
- **Catalog UI is built**: client-facing `/catalog` (with an "Add product" form — every field except ASIN, since manual entries usually don't have one yet) and internal `/internal/brand/[brandId]/catalog`. Both render as dense, horizontally-scrollable tables (`.table-scroll`/`.table-dense` in globals.css) — not the default `overflow: hidden`, which was clipping columns.
- **Item-level margin calculator** (`/internal/brand/[brandId]/margin-calculator`) is a per-product spreadsheet, not a single-item form: one row per catalog product, sale price/COGS prefilled from the catalog, referral fee prefixed at a 15% default, FBA/FBM toggle swaps the fee columns (FBA fee+inbound+storage vs. one fulfillment-cost line) across the whole sheet. SKU/Title/Price columns are frozen (`position: sticky`) so they stay visible while scrolling to Profit/Margin. Has a search box (SKU/title/ASIN) and a "Save" button that persists every field to `margin_calculator_inputs` (a separate table, not `products.msrp`/`cost_landed` — those get overwritten by the next sheet sync) — reload the page and saved edits are still there.
- **External weekly reports** (`reports.flagshipgrowth.com`) are linked, not synced: `brands.weekly_report_urls`/`inventory_report_urls` (jsonb `{label, url}[]`, migration 0013) surfaced as a "Reports" section on both the client dashboard and internal brand hub. Refreshed by Joey's own pipeline every Mon/Tue — nothing on our end to keep in sync, just live outbound links. Only 19 of 23 brands have these (WINK, Addasound, Be You Tiful Athletics, Noggin Boss don't). Hapad holds two report pairs (US + Canada) under its one brand row, distinguished by `label`. Matched by our existing (sometimes wrong) brand names — **"Reshoev8er" here is spelled "Reshoevn8r" in the actual reports/spec-sheet titles**, a likely typo from the original brand seed (migration 0009) that would need a wider rename (tasks, margin data, etc.) to fix properly.

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
