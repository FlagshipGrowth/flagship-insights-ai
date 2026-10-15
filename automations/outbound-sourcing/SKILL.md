---
name: outbound-sourcing
description: Outbound Sales Engine sourcing run. Finds $20k+/mo Amazon brands with Helium10, pre-screens their listings, finds the decision-maker, and posts everything to Flagship Insights, where it is deduped, suppressed and scored into tiers A-C.
---

Source new-brand prospects for Flagship Growth's outbound engine and send them to Flagship Insights AI. This runs unattended with no prior context, so follow this exactly. You only source, research and report. Never email, DM or contact anyone, and never write to any account.

BATCH SIZE: `{{batch_size}}` new brands (use 10 for the pilot run if this is blank). Stop once that many are posted, even if more look good.

TARGETS
- Eligible: brands doing roughly $20k+/mo on Amazon or DTC. Core categories are CPG food, beverage and supplements. Also pursue categories where Flagship has case studies (shoe care like Reshoevn8r, baby like MAAM Baby, sleep/mattress like Dormeo, workwear like Carhartt).
- Do not filter out current clients, past contacts or opt-outs yourself. The server does that and tells you what it skipped. Do skip obvious mega-brands (household names doing $5M+/mo); they aren't the fit.

STEP 1: SOURCE (Helium10 MCP)
Load tools with ToolSearch "+helium10 search products market" if they aren't loaded. Helium10 calls are a shared, limited budget (1,000/month across the team), so keep sourcing plus pre-screen to about 2 calls per brand. Pull candidate products from target categories with search_products / get_market_products, filtered to estimated revenue $20k+/mo. Group by brand. Product titles often carry the brand name; scrub it out to get a clean brand name. Prefer brands with steady review velocity or a launch in the last 90 days.

STEP 2: PRE-SCREEN
For each brand's best-selling ASIN, read the listing with Helium10 `retrieve_listing_by_asin` (1 call per brand; Amazon blocks direct page fetches, so don't spend time on WebFetch of amazon.com). Record only what you actually verified:
- mainImageWeak (true if the main image is cluttered, low-res, poorly framed or not filling the frame), imageCount, hasAPlus, titleWeak (missing key terms, keyword-stuffed or unclear), keywordGaps (only if you checked competitors' terms), rating, reviewCount.
- onWalmart / onTikTokShop: search walmart.com and TikTok Shop for the brand. Set false only if you looked and it isn't there.
- bsrChange90dPct: % change in BSR over 90 days if you have the history (positive = rank number went up = losing share). If BSR is falling, check price history and stock. If a stockout, price change, seasonality or suppression explains it, set bsrDropExplained: true.
- fundingWithin90d / launchWithin90d: search the web for recent funding or new product launches.
Leave a field out entirely if you didn't verify it. A missing field scores as "no gap"; a wrong field scores as a gap that doesn't exist. Never guess.

STEP 3: FIND THE DECISION-MAKER
Contacts are optional. Post the brand even if you find nobody; the team adds contacts later, and nothing can be emailed without a verified address anyway. Find the founder, CEO, owner or director of ecommerce. Record full name, title, LinkedIn URL and the brand's Instagram handle. For email: only set emailVerified: true if a verifier confirmed it. A guessed pattern (first@brand.com) is emailVerified: false. Add one short personal detail per contact (a podcast they were on, a post, their background).

STEP 4: RESEARCH NOTES
2-4 sentences per brand: the brand story, product line, recent news, and the single most specific listing finding you saw. Specific to this brand only, nothing generic.

STEP 5: DELIVER
1. Save the OUTBOUND_SYNC_SECRET value from your task prompt (and nothing else) to `.outbound-sync-secret` at the repo root with the Write tool. That file is gitignored. If the prompt didn't include a secret and the file doesn't exist, stop and report it. Never put the secret in a command line or curl it yourself.
2. Write up to 50 prospects per file and run `python3 automations/outbound-post.py ingest <that file>` from the repo root. JSON body:
```json
{
  "source": "outbound-sourcing agent",
  "prospects": [
    {
      "companyName": "Brand Name",
      "website": "https://brand.com",
      "amazonStoreUrl": "https://www.amazon.com/stores/...",
      "primaryAsin": "B0XXXXXXX",
      "category": "Supplements",
      "estMonthlyRevenue": 85000,
      "facts": {
        "mainImageWeak": true, "imageCount": 5, "hasAPlus": false, "titleWeak": false,
        "rating": 4.1, "reviewCount": 230, "onWalmart": false, "onTikTokShop": true,
        "bsrChange90dPct": 35, "bsrDropExplained": false, "launchWithin90d": true
      },
      "researchNotes": "...",
      "requestAudit": false,
      "contacts": [
        {
          "fullName": "Jane Doe", "title": "Founder & CEO", "email": "jane@brand.com", "emailVerified": false,
          "linkedinUrl": "https://www.linkedin.com/in/...", "instagramHandle": "@brand",
          "personalDetail": "...", "isPrimary": true
        }
      ]
    }
  ]
}
```
3. The response lists `inserted` (with score and tier), `skipped` (with reason) and `droppedContacts`. Report those counts and the tier mix in your own output, plus the Helium10 calls you used.

Do not touch git, do not deploy anything, and do not modify any files in the flagship-insights-ai repo other than writing the secret file. Never print the secret in your report.
