# Phase 1 — Amazon Ads + SP-API developer application

This is the actual long pole for Phase 2+ (sync layer can't pull real data until this clears),
and it's mostly a business/legal task, not code — most of these steps need Joey directly.

## What it unlocks

- Amazon Ads reporting (spend, ACOS/TACOS, campaign performance)
- SP-API: Business Reports (sales, sessions, conversion), FBA inventory
- This is what makes `connections` rows for `channel = 'amazon'` real instead of stubbed —
  see `netlify/functions/lib/channels/amazon.ts`.

## Steps

1. **Register as a developer** at [developer.amazonservices.com](https://developer.amazonservices.com) (SP-API) and the [Amazon Ads console](https://advertising.amazon.com/API) under Flagship Growth's business entity (not a personal account).
2. **Decide the application model**: this is a multi-tenant app (each client connects their own Amazon account via LWA OAuth), not a single-seller integration — the application needs to describe it that way from the start. Re-reading SPEC.md §3: every channel is client-initiated OAuth.
3. **Request roles/scopes**:
   - SP-API: `Selling Partner Insights`, `Inventory and Order Tracking`, `Pricing` (only what's actually used — request narrowly, broad asks slow review)
   - Ads API: read access to campaign/ad-group/keyword reporting
4. **Write the intended-use description** — reviewers want a concrete explanation, not marketing copy. Reuse this as a starting draft:
   > Flagship Growth is an e-commerce growth agency. This application lets our clients connect
   > their own Amazon Seller Central and Ads accounts (via LWA OAuth) so Flagship's insights
   > platform can display their own performance data and AI-generated recommendations back to
   > them. Flagship never accesses a client's account except through that client's own
   > authorized connection, and each client only ever sees their own data.
5. **Security review prep**: SP-API/Ads review will ask about token storage. Point to `connections.tokens` in `netlify/database/migrations/0001_initial-warehouse-schema/migration.sql` — tokens are stored encrypted at the application layer (AES-256-GCM, see `netlify/functions/lib/crypto.ts`) and scoped one row per brand per channel.
6. **Submit and track status** — lead time is "weeks" per SPEC.md §9. Update the status table below as it moves.

## Status

| Item | Status | Date |
|---|---|---|
| SP-API developer registration | Not started | — |
| Ads API developer registration | Not started | — |
| Application submitted | Not started | — |
| Approved | Not started | — |

## Related open decision

Token encryption scheme (app-level, before the `bytea` column in `connections`) has a proposed
implementation now: AES-256-GCM envelope encryption, see `netlify/functions/lib/crypto.ts`.
Pending Joey's sign-off (or a swap for a managed KMS) before it's exercised against a real
connection — mention this scheme in the security review once confirmed.
