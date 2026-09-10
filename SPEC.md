# Flagship Insights AI — Project Brief

Status: draft v0.2 · Owner: Joey Giazzon · Last updated: 2026-09-10

---

## Start here (current state, read this first)

- **What's built:** a Phase 0 proof-of-concept — a subagent + synthesis pipeline that takes one brand's channel metrics and writes an AI recommendation. It lives in `phase0/` (subagents.py, synthesis.py, run_insight.py, test_smoke.py, sample_data/). It's been smoke-tested with a stubbed client (no real API key used yet) and the plumbing works.
- **Test brand:** BB-Bands (Joey's own brand, Amazon-only). `phase0/sample_data/bb_bands_amazon.json` currently holds placeholder numbers, clearly marked as such — not real BB-Bands data yet.
- **What's NOT built yet:** any OAuth, the database/warehouse, the client or internal portals, the knowledge-ingestion pipeline (Slack/Gmail/Fathom/docs), or auth. Don't start these yet — see the phased roadmap in §10.
- **Immediate next step:** get real BB-Bands Amazon performance data (Business Report export, SellerRise export, or Seller Central numbers) into the same shape as `sample_data/bb_bands_amazon.json`, then run the pipeline for real and judge whether the recommendation is actually good — specific and non-obvious — or generic filler. Everything else waits on this.
- **Priority order on integrations:** Amazon first (it's what BB-Bands and most of the roster actually use). QuickBooks is deprioritized — least important integration right now, revisit later. Meta, Google, Walmart get built out as specific clients need them.

---

## 1. Overview & goals

One portal, two audiences. Clients log in and see their own brand's performance and AI-generated recommendations across every channel Flagship touches. Internal staff log in and see the same thing, plus every other client, filterable, aggregated to the business as a whole.

- **Views:** Daily, MTD, YTD, and Lifetime for every metric, built from one underlying time-series table rather than four separate systems.
- **Refresh model:** client dashboards refresh on login and cache in between; the internal view refreshes automatically every night regardless of whether any client has logged in.
- **Insights from day one:** the portal surfaces AI-written recommendations grounded in Flagship's own institutional knowledge (calls, Slack, email, past reports), not just raw metrics.
- **Multi-user clients:** a client account can invite teammates, not just one login per brand.

## 2. Users & access

| Role | Scope | Sees data & insights | Manages connections |
|---|---|---|---|
| Client owner | Own brand(s) | Yes | Yes |
| Client teammate (invited) | Own brand(s) | Yes | Open — decide per invite |
| Account manager | Assigned clients | Yes | No |
| Internal admin | All clients + aggregate view | Yes | Yes (support access) |

**Open item:** whether invited teammates can manage the brand's own integrations, or are view-only, isn't decided — settle before building the invite flow.

## 3. Data sources & integrations

Every channel is client-initiated OAuth — the client connects their own account. Each platform below is also a formal developer/partner application, not just an API key.

| Channel | Auth | Platform approval | Priority | Notes |
|---|---|---|---|---|
| Amazon Ads + SP-API | OAuth (LWA) | Required | **Now** | Also the source of FBA inventory data |
| Meta Ads | OAuth | Required | As clients need it | App review for ad-account read scopes |
| Walmart Marketplace | OAuth | Required | As clients need it | Ads + Walmart-fulfilled inventory |
| Google Ads | OAuth + dev token | Required | As clients need it | Basic access first, Standard access to serve real clients at scale |
| QuickBooks Online | OAuth (Intuit) | Required | **Deferred** | Least important integration right now — revisit once Amazon and other active channels are proven out |
| 3PL inventory | Varies by provider | — | As needed | No shared standard across providers; see §6 |
| Manual inbound | Native form | — | — | Stock not yet reflected anywhere else (in production, in transit) |

## 4. Data model

| Entity | Key fields | Purpose |
|---|---|---|
| `clients` | id, name, plan, status | The paying account; may hold multiple brands |
| `brands` | id, client_id, name, channels_enabled | What clients and internal staff actually view |
| `users` | id, client_id (null for staff), role, email | Login identities, both universes |
| `connections` | id, brand_id, channel, tokens (encrypted), last_synced_at | One row per OAuth connection per brand per channel |
| `metrics_daily` | brand_id, channel, date, metric_key, value | Powers every view — Daily/MTD/YTD/Lifetime are date-range filters on this |
| `inventory_snapshot` | brand_id, sku, source, quantity, as_of_date | source ∈ {amazon, walmart, a named 3PL, manual} |
| `knowledge_chunks` | id, scope (house/client), brand_id, source, content, embedding | Retrieval corpus for the AI layer — see §7 |
| `insights` | id, brand_id, period, summary, recommendations[], source_refs[] | What ships to the portal; source_refs keeps it auditable |

## 5. Sync & refresh architecture

Two refresh paths write to the same warehouse: a nightly job that keeps the internal view always current, and an on-login pull that keeps client-facing dashboards fast without paying for a sync no one's about to look at.

**Flow:** Source platforms (Amazon/Walmart, Meta/Google, QuickBooks, 3PLs/manual) → **Sync layer** (nightly + on-login) → **Data warehouse** (Postgres, time-series). In parallel: knowledge sources (Slack/Gmail, Fathom calls, internal docs) → **Knowledge ingestion** (chunk + embed + tag house/client) → **Vector store** (pgvector). Both converge into the **AI synthesis layer** (Claude subagents + retrieval), which feeds the **client portal** (cached at login) and **internal portal** (always fresh, all clients). The synthesis layer never lets one client's knowledge chunks surface in another client's output.

- Daily/MTD/YTD/Lifetime are all date-range queries against `metrics_daily` — no special-cased logic per view.
- **Historical depth caveat:** ad platform APIs cap how far back you can pull, regardless of what's visible in their own UI. Lifetime effectively means "since the connection was made," plus whatever's exported manually at onboarding.

## 6. Inventory model

Total inventory is a sum across every source that holds stock for a brand:

- **Amazon:** FBA inventory via SP-API — comes free once the Amazon connection exists.
- **Walmart:** Walmart-fulfilled inventory via the Walmart Marketplace API.
- **3PLs:** several different providers across the roster, no shared API standard — build one internal adapter interface (`sku, quantity, location, as_of_date`) and implement a connector per 3PL, starting with whichever provider covers the most clients today.
- **Manual inbound:** a plain form in the portal for stock not yet reflected anywhere else (in production, in transit).

Build note: treat the 3PL side as an ongoing integration backlog, not a single feature. Ship Amazon + manual entry first.

## 7. AI insights architecture

- **Metrics subagents:** one per channel (today: Amazon only, for BB-Bands) analyzing the current period against trend. Add Meta/Google/QuickBooks/inventory subagents later by extending `phase0/subagents.py`'s `CHANNEL_SYSTEM_PROMPTS`.
- **House tier:** patterns/judgment learned across all of Flagship's Slack, email, calls, docs, and past reports — shared across every client. Not built yet.
- **Client tier:** that brand's own communications and history — retrieved only for that brand's own insights, never anyone else's. Not built yet.
- **Synthesis agent:** combines metrics + house tier + client tier into the recommendation that ships to the portal. Today it only has metrics findings to work with (`phase0/synthesis.py`) — the knowledge layers come in a later phase.
- **Audit trail:** every insight should store which data period and knowledge chunks it drew on, so a recommendation can be explained or checked later. Not built yet — design for it when the `insights` table gets built.

## 8. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend + functions | Netlify | Scheduled functions trigger; background functions do the real work (30s cap on scheduled, longer on background) |
| Database | Netlify DB (Neon Postgres) | One database for both metrics and embeddings via pgvector |
| AI | Anthropic API, Claude Agent SDK | Called from background functions, not exposed to clients directly |
| Auth | Not yet chosen | Needs multi-user-per-client + separate internal roles — Supabase Auth, Auth0, and Clerk all fit; pick before Phase 3 |

Phase 0 itself is plain Python (see `phase0/requirements.txt`) — disposable proof-of-concept code, not meant to become the Netlify implementation directly.

## 9. Platform approval workstream

These are the long poles, not the software — but priority follows what's actually being used, not lead time alone.

| Platform | What's needed | Lead time | Priority | Status |
|---|---|---|---|---|
| Amazon Ads / SP-API | Developer/partner application | Weeks | **Now** | Not started |
| Meta Marketing API | App review for ad-account read scopes | 1–2+ weeks | As clients need it | Not started |
| Walmart Marketplace | Partner access approval | Weeks | As clients need it | Not started |
| Google Ads API | Developer token, Basic → Standard access | Weeks | As clients need it | Not started |
| QuickBooks (Intuit) | Production access + security assessment for financial data | Longest of the five | **Deferred** | Not started |

## 10. Phased roadmap

1. **Phase 0 — Prove the AI, no OAuth required.** *(In progress)* Subagent + synthesis pipeline built and smoke-tested against BB-Bands (Amazon only). Next: swap in real BB-Bands numbers and judge recommendation quality.
2. **Phase 1 — File the Amazon platform application (parallel with Phase 0).** Other platforms (Meta, Walmart, Google) as specific clients need them. QuickBooks deferred — don't start it yet. Start the first 3PL adapter once a client needs one.
3. **Phase 2 — Warehouse & sync.** Build the data warehouse and nightly + on-login sync layer, wiring up whichever platforms clear approval first.
4. **Phase 3 — Client portal.** Auth, multi-user invites, client-facing dashboard on top of the warehouse.
5. **Phase 4 — Internal portal.** Filter/aggregate across every client, reusing the same data layer.
6. **Phase 5 — Live AI insights.** Turn on the insights layer inside the real portal once Phase 0 has proven the logic and the knowledge-ingestion pipeline is wired up end to end.

## 11. Open risks & decisions log

| Item | Status | Note |
|---|---|---|
| Invited teammate permissions | Open | View-only vs. can manage connections — decide before building invites |
| 3PL adapter priority order | Open | Needs a list of which 3PL each client actually uses |
| Auth provider | Open | Supabase Auth / Auth0 / Clerk — pick before Phase 3 |
| Historical depth per platform | Accepted constraint | Lifetime = since connection date; set client expectations accordingly |
| Recording consent for AI training | Resolved | Already covered by existing agreements |
| QuickBooks priority | Resolved | Deprioritized — least important integration right now; revisit once Amazon and other active channels are proven out |
| Knowledge isolation enforcement | Must design carefully | Tag every chunk at ingestion; test that client-tier retrieval can't cross brands before shipping to a second client |

---

## Working conventions

- Keep Phase 0 code disposable — it's a proof of concept for the subagent + synthesis pattern, not the production sync layer from §5.
- Don't start on client OAuth flows, the Netlify app shell, the auth provider, or the knowledge-ingestion pipeline until Phase 0's core recommendation quality is validated on real data.
- Claude Agent SDK is the intended AI layer long-term (not ad hoc API calls) — Phase 0 is the place to establish the subagent pattern that carries through to later phases.
- One channel today (Amazon). Design additions (Meta, QuickBooks, inventory, etc.) as more entries in `CHANNEL_SYSTEM_PROMPTS`, not a rewrite.

## What to do right now

Help me get real BB-Bands Amazon data into `phase0/sample_data/bb_bands_amazon.json` (or a new file in the same shape), run `phase0/run_insight.py` against it, and evaluate whether the recommendation it produces is genuinely useful — specific to the numbers, not generic. If it's weak, we iterate on the prompts in `subagents.py` and `synthesis.py` before touching anything else in the roadmap.
