---
name: outbound-audit
description: Outbound Sales Engine audit run. Claims the next Tier A/B prospects from Flagship Insights, runs a Helium10 deep audit on each, and posts each audit back as a draft for Joey to approve.
---

Audit the next batch of outbound prospects for Flagship Growth and send each audit to Flagship Insights AI. This runs unattended with no prior context, so follow this exactly. You only research and write. Never email, DM or contact anyone, never change any Amazon listing, and never write to any account.

BATCH SIZE: `{{batch_size}}` brands (use 10 if blank; that's the pilot).

WHAT GOOD LOOKS LIKE
Each audit reads like a mini version of the work Flagship does for its own clients. Every finding must be specific to this brand and checkable on its live listing today: name the ASIN, the keyword, the competitor, the image slot. Nothing generic ("optimize your images", "improve your keywords"), no revenue promises, no claims you didn't verify. Short and concrete beats long.

SENDING DATA TO THE APP
Every call to the app goes through `python3 automations/outbound-post.py <endpoint> <json-file> [out-file]`, run from the repo root. Never put the secret in a command line or curl it yourself. Before the first call, save the OUTBOUND_SYNC_SECRET value from your task prompt (and nothing else) to `.outbound-sync-secret` at the repo root with the Write tool. That file is gitignored. If the prompt didn't include a secret and the file doesn't exist, stop and report it.

STEP 1: CLAIM THE BATCH
1. Write `{"limit": <batch size>}` to a scratch file and run `python3 automations/outbound-post.py audit-queue <that file> <scratch>/queue.json`.
2. The response's `prospects` are now claimed for you. Each has prospectId, companyName, tier, score, launchTrack, primaryAsin, website, category, estMonthlyRevenue, facts (what sourcing already verified) and researchNotes. If it's empty, report that and stop.

STEP 2: DEEP AUDIT (Helium10 MCP, about 8 calls per brand)
Load tools with ToolSearch "+helium10 listing competitors keywords" if they aren't loaded. Helium10 calls are a shared, limited budget (1,000/month across the team), so count every call you make per brand; you'll report the number. Aim for about 8:
1. retrieve_listing_by_asin on primaryAsin: title, bullets, images, A+, price, rating, reviews.
2. get_listing_score: where the listing loses points.
3. search_competitors_by_asin: pick the 2-3 closest real competitors (same product type and price band, not a random category leader).
4. compare_asin_keywords (brand vs those competitors): high-volume terms they rank for and the brand doesn't.
5. analyze_product_images on the brand's listing: main image and gallery problems.
6. get_asin_bsr_history: confirm the trend sourcing recorded.
7. search_product_targets_by_asin: who's advertising on and around their listing (competitors bidding on their product page and brand terms).
8. get_asin_review_analysis on primaryAsin: the top recurring complaints and praise in their reviews.
If the brand has no primaryAsin, or retrieve_listing_by_asin fails, skip it (it stays claimed and is released automatically after a day) and say so in your report.

STEP 3: MAIN IMAGE NOTES
1. Take the brand's real current main image URL from the listing (the large hi-res image). That URL goes in `originalImageUrl`; the audit page shows it.
2. Don't generate or edit any product image. Write `findings.mainImageNotes`: 1-2 sentences on exactly what to change about today's main image (framing, props, overlaid text, resolution, wrong variant), measured against Amazon's main-image rules and the competitors you benchmarked.

STEP 4: WRITE THE AUDIT
- `headline`: the single biggest finding, in one plain sentence with a number in it where you have one. Example shape: "You're missing 6 search terms worth ~48,000 searches a month that your top 2 competitors rank for."
- `findings.summary`: 2-3 sentences: what's working, the biggest gap, and the quickest win.
- `findings.keywordGaps`: up to 10 rows, highest volume first: keyword, monthlySearchVolume, competitorsRanking ("Brand X #3, Brand Y #7"), brandRank (number, or null if not ranking).
- `findings.competitorBenchmark`: the brand first with isBrand: true, then the 2-3 competitors: name, asin, price, rating, reviewCount, bsr, imageNote (one short phrase on their main image or gallery).
- `findings.imageStackFixes`: the 3-5 highest-impact gallery fixes, each {title, detail}. Name the slot ("Image 3 is a second lifestyle shot; nothing shows the size or what's in the box").
- `findings.aPlusFixes`: up to 3, same shape. If they have no A+ at all, say that as the first item.
- `findings.adsGaps`: up to 3, only what you could actually see from step 2.7: which competitors are advertising on their listing or brand terms, and where they're missing ad coverage. Name the competitors. Leave empty rather than guess.
- `findings.reviewInsights`: up to 3, from step 2.8: the most common complaints (with how often they come up if the data shows it) and what customers love that the listing doesn't say. Each {title, detail}, with what to do about it.
- `findings.pricingNotes`: up to 3, from the competitor benchmark: their price and price per unit/serving/ounce against the 2-3 competitors (do the math from the pack sizes on the listings), and whether the listing justifies any premium. Only use prices and sizes you saw.
- `findings.launchOpportunity`: only when the prospect's launchTrack is true or the facts show onWalmart/onTikTokShop false. {channel: "walmart" | "tiktok_shop" | "both", estimate: a range grounded in their Amazon numbers and the category (say what you based it on), plan: 2-3 sentences on what a launch would look like}. Otherwise null.
- `kind`: "deep" normally; "launch" if the launch opportunity is the main story.

STEP 5: DELIVER (once per brand, as soon as that brand is done)
Write the audit to a JSON file and run `python3 automations/outbound-post.py audits <that file>`. Body:
```json
{
  "prospectId": "<from the queue>",
  "kind": "deep",
  "headline": "...",
  "helium10Calls": 7,
  "originalImageUrl": "https://m.media-amazon.com/images/I/....jpg",
  "findings": {
    "summary": "...",
    "keywordGaps": [{"keyword": "...", "monthlySearchVolume": 12000, "competitorsRanking": "...", "brandRank": null}],
    "competitorBenchmark": [{"name": "...", "asin": "...", "price": 24.99, "rating": 4.4, "reviewCount": 1830, "bsr": 4120, "imageNote": "...", "isBrand": true}],
    "imageStackFixes": [{"title": "...", "detail": "..."}],
    "aPlusFixes": [],
    "adsGaps": [],
    "reviewInsights": [{"title": "...", "detail": "..."}],
    "pricingNotes": [{"title": "...", "detail": "..."}],
    "launchOpportunity": null,
    "mainImageNotes": "..."
  }
}
```
The response has a `previewUrl`. It stays a draft (only Joey can open it) until he approves it in the CRM.

REPORT
At the end, list each brand with its headline, Helium10 calls used and preview URL, the total Helium10 calls for the run, and any brand you skipped and why.

Do not touch git, do not deploy anything, and do not modify any files in the flagship-insights-ai repo other than writing the secret file. Never print the secret in your report.
