---
name: tiktok-shop-daily-sync
description: Pulls TikTok Shop performance for TUBR, Smood Sweets, and Jax Athletics from Euka/Reacher into their brand dashboards. Reports which brands aren't connected yet rather than failing.
---

Sync yesterday's TikTok Shop performance for three specific Flagship Growth client brands into Flagship Insights AI. This runs unattended with no prior context, so follow this exactly.

CRITICAL SAFETY CONSTRAINT: only ever read data for these three brands: TUBR, Smood Sweets, Jax Athletics. NEVER read, write, or reference SuperMush under any circumstances, even if it's the only brand that shows up as connected in a tool call — Joey has explicitly excluded it from this module.

Brand IDs in Flagship Insights AI's own database (use these exact values when posting):
- TUBR: 7424b41a-e714-4992-b966-f73844c8c118
- Smood Sweets: e69f6da5-4005-429c-a16a-f9482e806a21
- Jax Athletics: 9e5a7812-8049-48ea-9612-ac74fd790946

KNOWN STATE (as of this task's creation — re-verify each run, connections may have been fixed since):
- Euka (tool prefix mcp__1a18d48e-08e8-49e9-8b51-24756c8851be__): calling list_accessible_brands only returned SuperMush. None of the 3 target brands were connected. If that's still true, skip Euka entirely for the unconnected ones — do not guess at IDs.
- Reacher (tool prefix mcp__018e23b2-68f3-4eba-916e-ee8ed328ae12__): list_shops_shops_get returned shop_id 7903 "Tubr Storage" (status "pro_new") and shop_id 10625 + 10708 both "SmoodSweets" (status "inactive"). No Jax Athletics shop found. However, calling dashboard/GMV tools (e.g. shop_gmv_summary_shop_gmv_summary_post, seller_center_shop_overview) for shop_id 7903 failed with "Missing x-shop-id header" regardless of how the shop id was passed as an argument — this looks like a connector-level configuration issue (the x-shop-id may need to be set where this MCP connector itself is configured, not per-call). If you hit the same error, do NOT keep retrying different argument names — that was already tried exhaustively. Just record it as blocked and move on.

Steps, for each of the 3 brands:
1. Try Euka first: if ToolSearch hasn't loaded it, call ToolSearch "select:mcp__1a18d48e-08e8-49e9-8b51-24756c8851be__list_accessible_brands,mcp__1a18d48e-08e8-49e9-8b51-24756c8851be__get_dashboard_performance_overview,mcp__1a18d48e-08e8-49e9-8b51-24756c8851be__get_dashboard_affiliate_funnel,mcp__1a18d48e-08e8-49e9-8b51-24756c8851be__get_dashboard_shop_health". Call list_accessible_brands, check if this brand (by name) appears. If yes, use its storeId to call get_dashboard_performance_overview / get_dashboard_affiliate_funnel / get_dashboard_shop_health for yesterday's date and extract whatever GMV/affiliate/health numbers are available.
2. If Euka doesn't have it, try Reacher: ToolSearch "select:mcp__018e23b2-68f3-4eba-916e-ee8ed328ae12__list_shops_shops_get,mcp__018e23b2-68f3-4eba-916e-ee8ed328ae12__shop_gmv_summary_shop_gmv_summary_post,mcp__018e23b2-68f3-4eba-916e-ee8ed328ae12__seller_center_shop_overview" if needed. Call list_shops_shops_get, match by name, try pulling GMV for yesterday. If you hit the "Missing x-shop-id header" error, stop trying that brand via Reacher and note it as blocked (connector config issue), don't loop retrying.
3. Whatever numeric metrics you get (map to metric_key names like gmv, affiliate_gmv, shop_health_score — use your judgment for what each tool's fields actually mean), build rows: {brandId: <the exact UUID above for this brand>, date: "<yesterday, YYYY-MM-DD>", metric_key: <name>, value: <number>}.
4. If you got zero real metrics for a brand (not connected, or blocked by the header issue), skip it — do not fabricate zeros or placeholder values.

After all 3 brands:
5. If you collected any rows at all, read the sync secret: cat "/Users/joeygiazzon/Projects/flagship-insights-ai/.tiktok-shop-sync-secret", then POST all rows in one call to https://flagship-insights-ai.netlify.app/api/tiktok-shop/sync as JSON body {"rows": [...]}, header Authorization: Bearer <secret>, via curl.
6. If you got zero rows across all 3 brands (expected right now, given the known blockers above), don't POST anything — just note in your own output which brands are still blocked and why (not connected vs. connector header issue), so the next run's context is clear if this gets reviewed.

Do not touch git, do not deploy anything, do not modify any files in the flagship-insights-ai repo other than reading the secret file.