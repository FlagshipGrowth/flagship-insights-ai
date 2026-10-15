---
name: outbound-audit
description: Outbound Sales Engine audit run. Claims the next Tier A/B prospects from Flagship Insights, runs a Helium10 deep audit on each, generates an AI main-image concept from the brand's real product photo, and posts each audit back as a draft for Joey to approve.
---

Audit the next batch of outbound prospects for Flagship Growth and send each audit to Flagship Insights AI. This runs unattended with no prior context, so follow this exactly. You only research and write. Never email, DM or contact anyone, never change any Amazon listing, and never write to any account.

BATCH SIZE: `{{batch_size}}` brands (use 10 if blank; that's the pilot).

WHAT GOOD LOOKS LIKE
Each audit reads like a mini version of the work Flagship does for its own clients. Every finding must be specific to this brand and checkable on its live listing today: name the ASIN, the keyword, the competitor, the image slot. Nothing generic ("optimize your images", "improve your keywords"), no revenue promises, no claims you didn't verify. Short and concrete beats long.

STEP 1: CLAIM THE BATCH
1. Read the secret: cat "/Users/joeygiazzon/Projects/flagship-insights-ai/.outbound-sync-secret"
2. POST https://flagship-insights-ai.netlify.app/api/outbound/audit-queue with header `Authorization: Bearer <secret>` and body `{"limit": <batch size>}`.
3. The response's `prospects` are now claimed for you. Each has prospectId, companyName, tier, score, launchTrack, primaryAsin, website, category, estMonthlyRevenue, facts (what sourcing already verified) and researchNotes. If it's empty, report that and stop.

STEP 2: DEEP AUDIT (Helium10 MCP, about 7 calls per brand)
Load tools with ToolSearch "+helium10 listing competitors keywords" if they aren't loaded. Helium10 calls are a shared, limited budget (1,000/month across the team), so count every call you make per brand; you'll report the number. Aim for about 7:
1. retrieve_listing_by_asin on primaryAsin: title, bullets, images, A+, price, rating, reviews.
2. get_listing_score: where the listing loses points.
3. search_competitors_by_asin: pick the 2-3 closest real competitors (same product type and price band, not a random category leader).
4. compare_asin_keywords (brand vs those competitors): high-volume terms they rank for and the brand doesn't.
5. analyze_product_images on the brand's listing: main image and gallery problems.
6. get_asin_bsr_history: confirm the trend sourcing recorded.
7. search_product_targets_by_asin: sponsored ad visibility (who's advertising on and around them).
If the brand has no primaryAsin, or retrieve_listing_by_asin fails, skip it (it stays claimed and is released automatically after a day) and say so in your report.

STEP 3: MAIN IMAGE CONCEPT (Higgsfield MCP)
1. Take the brand's real current main image URL from the listing (the large hi-res image). That URL goes in `originalImageUrl`.
2. Import it as the reference (media_import_url), then generate one square concept with generate_image that keeps the exact same product: same packaging, label, colors, shape and count. Only change the presentation, following Amazon main-image rules: pure white background (RGB 255,255,255), product fills about 85% of the frame, sharp and well lit, no text, logos, badges, props or extra items that aren't in the box.
3. Look at the result before using it. If the product changed in any way (a different label, a wrong flavor, an extra item, warped text), regenerate once; if it's still wrong, leave the concept out of this audit. Never generate a product that doesn't exist.
4. Download the final image and base64-encode it for `mainImageBase64` (PNG or JPEG, under 4MB), with `mainImageContentType` set to match.
5. Write `findings.mainImageNotes`: 1-2 sentences on what the concept fixes compared with today's image.

STEP 4: WRITE THE AUDIT
- `headline`: the single biggest finding, in one plain sentence with a number in it where you have one. Example shape: "You're missing 6 search terms worth ~48,000 searches a month that your top 2 competitors rank for."
- `findings.summary`: 2-3 sentences: what's working, the biggest gap, and the quickest win.
- `findings.keywordGaps`: up to 10 rows, highest volume first: keyword, monthlySearchVolume, competitorsRanking ("Brand X #3, Brand Y #7"), brandRank (number, or null if not ranking).
- `findings.competitorBenchmark`: the brand first with isBrand: true, then the 2-3 competitors: name, asin, price, rating, reviewCount, bsr, imageNote (one short phrase on their main image or gallery).
- `findings.imageStackFixes`: the 3-5 highest-impact gallery fixes, each {title, detail}. Name the slot ("Image 3 is a second lifestyle shot; nothing shows the size or what's in the box").
- `findings.aPlusFixes`: up to 3, same shape. If they have no A+ at all, say that as the first item.
- `findings.adsGaps`: up to 3, only what you could actually see from step 2.7. Leave empty rather than guess.
- `findings.launchOpportunity`: only when the prospect's launchTrack is true or the facts show onWalmart/onTikTokShop false. {channel: "walmart" | "tiktok_shop" | "both", estimate: a range grounded in their Amazon numbers and the category (say what you based it on), plan: 2-3 sentences on what a launch would look like}. Otherwise null.
- `kind`: "deep" normally; "launch" if the launch opportunity is the main story.

STEP 5: DELIVER (once per brand, as soon as that brand is done)
POST https://flagship-insights-ai.netlify.app/api/outbound/audits with header `Authorization: Bearer <secret>` and JSON body:
```json
{
  "prospectId": "<from the queue>",
  "kind": "deep",
  "headline": "...",
  "helium10Calls": 7,
  "originalImageUrl": "https://m.media-amazon.com/images/I/....jpg",
  "mainImageBase64": "<base64>",
  "mainImageContentType": "image/png",
  "findings": {
    "summary": "...",
    "keywordGaps": [{"keyword": "...", "monthlySearchVolume": 12000, "competitorsRanking": "...", "brandRank": null}],
    "competitorBenchmark": [{"name": "...", "asin": "...", "price": 24.99, "rating": 4.4, "reviewCount": 1830, "bsr": 4120, "imageNote": "...", "isBrand": true}],
    "imageStackFixes": [{"title": "...", "detail": "..."}],
    "aPlusFixes": [],
    "adsGaps": [],
    "launchOpportunity": null,
    "mainImageNotes": "..."
  }
}
```
The response has a `previewUrl`. It stays a draft (only Joey can open it) until he approves it in the CRM.

REPORT
At the end, list each brand with its headline, Helium10 calls used and preview URL, the total Helium10 calls for the run, and any brand you skipped and why.

Do not touch git, do not deploy anything, and do not modify any files in the flagship-insights-ai repo other than reading the secret file.
