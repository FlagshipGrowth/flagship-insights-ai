---
name: sellerise-daily-sync
description: Pulls Amazon seller-analytics data (finance, PPC, inventory, alerts, reviews, payouts, Subscribe & Save, keyword rank, SQP, ads search-term/targeting) from Sellerise into each brand's dashboard and internal recommendations feed.
---

Sync yesterday's Amazon seller-analytics data from Sellerise into Flagship Insights AI, for every mapped brand. This runs unattended with no prior context, so follow this exactly.

SAFETY: This is the Amazon/Sellerise sync — it is allowed to touch SuperMush's US Amazon data (that's explicitly in scope). This is DIFFERENT from the separate TikTok Shop module, which excludes SuperMush entirely — don't confuse the two.

BRAND MAPPING (our brand name -> exact Sellerise account name / marketplace / our brand_id — use these exact values):
- Dormeo US -> Sellerise account "Dormeo", marketplace US -> brand_id 5cf54f6b-a915-4d44-8144-750e46dd582f
- Dormeo CA -> Sellerise account "Dormeo", marketplace CA -> brand_id d4c6559b-c5e7-47d9-bf51-e94f3ae672d4
- Reshoev8er US -> Sellerise account "Reshoevn8r", marketplace US -> brand_id 47645ffa-be42-42bc-adbd-b86b4ade52e4
- Reshoev8er CA -> Sellerise account "Reshoevn8r", marketplace CA -> brand_id 77c50ecb-73a4-4fd3-84d5-6eb318ca12ce
- Hapad -> Sellerise account "Hapad", marketplace US -> brand_id fa2e3440-b6cc-43be-8aa2-e4df2cefeb83
- Opopop -> Sellerise account "Opopop", marketplace US -> brand_id f8b88c0b-dc44-48e8-b55f-1a637c5c9e77
- Rationale Brewing -> Sellerise account "Rationale Brewing", marketplace US -> brand_id 69ec86da-da68-4d2d-a99e-2cdf1fe642ea
- TUBR -> Sellerise account "Tubr", marketplace US -> brand_id 7424b41a-e714-4992-b966-f73844c8c118
- MAC Energy -> Sellerise account "MAC Energy", marketplace US -> brand_id a0b0eacd-cb27-4a79-9730-0e4407a162ad
- Sidekick -> Sellerise account "SideKicks Supplies", marketplace US -> brand_id 8da6263a-dc08-4c42-9d53-0d9a66a34126
- Heavenly Bodies -> Sellerise account "Heavenly Bodies Studio", marketplace US -> brand_id c9366345-7dd0-4835-b081-d8d0bcd67138
- Smood Sweets -> Sellerise account "Smood Sweets", marketplace US -> brand_id e69f6da5-4005-429c-a16a-f9482e806a21
- Lewie -> Sellerise account "Lewie", marketplace US -> brand_id ddb1b77c-8387-4527-ace1-b9375f744fbf
- Jax Athletics -> Sellerise account "JAX Atheltics", marketplace US -> brand_id 9e5a7812-8049-48ea-9612-ac74fd790946
- CaddyO -> Sellerise account "CaddyO", marketplace US -> brand_id f828f184-35f8-469e-baec-498a979200a4
- SuperMush -> Sellerise account "SuperMush", marketplace US -> brand_id 5bfa7c1e-494e-424d-b173-4c7df8eca230

Sellerise MCP tool prefix: mcp__db66b211-e19e-4ca5-b743-ca7a85112be5__. If not loaded, ToolSearch "select:mcp__db66b211-e19e-4ca5-b743-ca7a85112be5__get_account_metrics,mcp__db66b211-e19e-4ca5-b743-ca7a85112be5__get_alert_summary,mcp__db66b211-e19e-4ca5-b743-ca7a85112be5__get_inventory_risks,mcp__db66b211-e19e-4ca5-b743-ca7a85112be5__get_ads_targeting_insights,mcp__db66b211-e19e-4ca5-b743-ca7a85112be5__analyze_sales_change,mcp__db66b211-e19e-4ca5-b743-ca7a85112be5__get_reimbursement_insights,mcp__db66b211-e19e-4ca5-b743-ca7a85112be5__get_payout_insights,mcp__db66b211-e19e-4ca5-b743-ca7a85112be5__get_sns_insights,mcp__db66b211-e19e-4ca5-b743-ca7a85112be5__get_review_insights,mcp__db66b211-e19e-4ca5-b743-ca7a85112be5__get_keyword_tracker_insights,mcp__db66b211-e19e-4ca5-b743-ca7a85112be5__get_keyword_sqp_insights,mcp__db66b211-e19e-4ca5-b743-ca7a85112be5__get_ads_search_term_insights,mcp__db66b211-e19e-4ca5-b743-ca7a85112be5__get_manual_adjustment_insights".

PART A — Metrics (write to metricRows, channel is always "amazon" server-side, you don't set it):
For each of the 16 brand rows above, call get_account_metrics with accountSearch=<exact Sellerise account name>, marketplaces=<marketplace>, start="yesterday", end="yesterday", groupBy="accountMarketplace" (or call once with all 16 filters batched sensibly — get_account_metrics/list_accounts support multi-account responses, so prefer fewer calls over 16 separate ones where the tool allows filtering to just your needed accounts/marketplaces at once). Extract per brand: revenue, net, margin, orders, units, refundRate (as refund_rate), ppc.spend (as ppc_spend), ppc.sales (as ppc_sales), ppc.acos (as acos), ppc.tacos (as tacos), ppc.cpc (as cpc).

Also write two RAW/summable metrics the client dashboard's Performance tiles derive everything else from (getBrandPerformanceTiles in lib/metrics.ts sums these across whatever date range is selected, rather than ever summing a ratio like acos/refund_rate directly — see that file's comments for why):
- ppc_clicks: from this same response's ppc.clicks field.
- refund_amount: this single-day response doesn't expose a raw refund dollar figure directly (only refundRate as a %), so derive it: refund_amount = (refundRate / 100) * revenue.

Also call get_payout_insights (mode=summary) for net_payout/product_payout/unallocated_payout, get_sns_insights (mode=summary) for sns_revenue/sns_net/sns_active_subs/sns_new_buyers/sns_oos_rate (skip any brand where this comes back empty — confirmed sparse/brand-dependent), get_review_insights for avg_rating/review_count/negative_review_pct (skip if empty), and get_keyword_tracker_insights (mode=top) for tracked_keywords_count/avg_keyword_rank. Build rows: {brandId: <exact uuid above>, date: "<yesterday, YYYY-MM-DD>", metric_key: <name>, value: <number>}. Skip any field that's null/missing — never fabricate a zero.

PART B — Recommendations (write to recommendationRows):
For each brand, pull and turn into AT MOST a few real findings per category (quality over quantity — don't manufacture filler):
- get_alert_summary with actionableOnly=true — real issues only (Buy Box lost, hijacker, stockout, suppression), never log-level noise.
- get_inventory_risks — SKUs at 0/low stock.
- get_ads_targeting_insights mode=waste and mode=high_acos — real wasted spend targets.
- get_ads_search_term_insights mode=harvest and mode=negative_candidates — real keyword opportunities/negatives.
- analyze_sales_change (last 7 complete days vs last 14 complete days) — only if the "expert" severity is medium or higher, i.e. a real notable move, not routine noise.
- get_reimbursement_insights mode=summary — only if there's a meaningful recovered/pending amount.
- get_keyword_tracker_insights mode=drops — real rank drops.
- get_keyword_sqp_insights mode=opportunities and mode=problems — real gaps.
- get_manual_adjustment_insights — only if something looks like it needs attention.
Translate every "expert" cause/action code to plain English in the body text (per each tool's own guidance) — never show raw snake_case codes to a human. These recommendations are shown to the client now, not just internal staff — never write the word "Sellerise" (or any other data-source/vendor name) anywhere in title/body text; describe findings in terms of the brand's own numbers only ("missing cost data" not "missing COGS data in Sellerise"). Build rows: {brandId: <exact uuid>, category: <short slug like "ppc_waste", "inventory_risk", "alert", "sales_change", "reimbursement", "keyword_rank", "sqp", "manual_adjustment">, severity: <"low"|"medium"|"high"|"critical" if the tool provides one, else omit>, title: <short specific headline>, body: <2-4 sentences: what you saw, the number, why it matters, a concrete next step>, metaRef: <optional short reference like an ASIN/SKU/target name>}.

PART C — Deliver:
1. Read the sync secret: cat "/Users/joeygiazzon/Projects/flagship-insights-ai/.sellerise-sync-secret"
2. POST everything in as few calls as practical to https://flagship-insights-ai.netlify.app/api/sellerise/sync as JSON body {"metricRows": [...], "recommendationRows": [...]}, header Authorization: Bearer <secret>, via curl.
3. If a brand has zero data available (e.g. not fully connected in Sellerise), skip it silently rather than erroring — note it in your own output only.

Do not touch git, do not deploy anything, do not modify any files in the flagship-insights-ai repo other than reading the secret file.