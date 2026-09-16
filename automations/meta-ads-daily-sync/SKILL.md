---
name: meta-ads-daily-sync
description: Pulls yesterday's Meta Ads performance for Flagship Growth's own account and syncs it to the Marketing Efforts dashboard.
---

Sync yesterday's Meta Ads performance data, and the current set of ad creative, for Flagship Insights AI's Marketing Efforts dashboard. This runs unattended with no prior context, so follow these steps exactly.

CRITICAL SAFETY CONSTRAINT: only ever touch Meta ad account 1287113856507273 ("Flagship Growth"). Never read or write any other ad account (there are others visible via ads_get_ad_accounts, including one called "FSG Meta" — do not touch it, and do not touch "Joey Giazzon" personal or any third-party account either). This task only ever READS ad entities — never create, update, delete, activate, or pause anything (that's the separate meta-ad-manager task's job, and even it only ever creates new PAUSED objects).

PART A — Performance metrics:
1. If mcp__0294fa2e-4fc6-47de-bdb9-f825998488ee__ads_get_ad_entities isn't already loaded, call ToolSearch with query "select:mcp__0294fa2e-4fc6-47de-bdb9-f825998488ee__ads_get_ad_entities,mcp__0294fa2e-4fc6-47de-bdb9-f825998488ee__ads_get_creatives".
2. Call ads_get_ad_entities with: ad_account_id "1287113856507273", level "account", fields ["amount_spent","impressions","clicks","reach","link_click","lead","cost_per_lead"], date_preset "yesterday", time_increment 1.
3. The response's `ad_entities` field is a JSON-encoded STRING — parse it. It returns one row for yesterday with fields like amount_spent: "$13.85 USD", impressions: "3849", lead: null, etc.
4. For each non-null field except date_start/date_stop/id/name, produce a row: {channel: "meta_ads", date: <date_start, "YYYY-MM-DD">, metric_key: <field name>, value: <number>}. Strip "$" and " USD" and commas from amount_spent/cost_per_lead before converting to a number. Skip null fields entirely — don't send zeros for them.
5. Read the sync secret with: cat "/Users/joeygiazzon/Projects/flagship-insights-ai/.marketing-sync-secret"
6. POST the rows to https://flagship-insights-ai.netlify.app/api/marketing/sync as JSON body {"rows": [...]}, with header Authorization: Bearer <secret>, via curl.
7. If curl returns a non-200 status or errors on this part, report it, but still continue to Part B below.

PART B — Creative gallery (keeps /internal/marketing's "Creative" section showing what's actually running):
1. Call ads_get_ad_entities with: ad_account_id "1287113856507273", level "ad", fields ["ad_name","adset_name","campaign_name","effective_status","creative"], object_state "live" — this returns every non-deleted ad with its creative_id and effective_status (ACTIVE/PAUSED/etc).
2. Call ads_get_creatives with ad_account_id "1287113856507273" and creative_ids = the list of creative_id values from step 1 (batch them all in one call if the tool allows an array).
3. For each creative: use its "title" as headline (may be absent), "body" as bodyCopy (may be absent), and the best available image — prefer `image_url` if present, otherwise `thumbnail_url`. Download that image with curl (follow redirects, -L), and base64-encode the bytes (e.g. `base64 -i file` or `openssl base64 -A`). Skip a creative entirely if neither image_url nor thumbnail_url is present, or the download fails.
4. Determine the content type from the downloaded image (png vs jpeg) — Meta image URLs are almost always jpeg or png.
5. POST each one to https://flagship-insights-ai.netlify.app/api/marketing/creatives (same Authorization header as Part A) with JSON body: {"metaCreativeId": "<creative id>", "adName": "<ad_name from step 1, or the creative's own name if no ad name>", "status": "<effective_status from step 1, e.g. ACTIVE or PAUSED>", "headline": "<title or null>", "bodyCopy": "<body or null>", "imageBase64": "<base64 string>", "imageContentType": "image/jpeg or image/png"}.
6. This is an upsert keyed on metaCreativeId — safe to re-run daily, re-syncing the same creative just refreshes its status/image. If a call fails, log it and move to the next creative rather than aborting the whole batch.

Do not touch git, do not deploy anything, do not modify any files in the flagship-insights-ai repo other than reading the secret file — this task's only job is reading Meta Ads data and POSTing it to those two endpoints.