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
Load tools with ToolSearch "+helium10 search products market" if they aren't loaded. Helium10 calls are a shared, limited budget (1,000/month across the team), so keep sourcing plus pre-screen to about 3-4 calls per brand (the monthly budget covers this at 10 brands a run, 3 runs a week, alongside the audits). Pull candidate products from target categories with search_products / get_market_products, filtered to estimated revenue $20k+/mo. Group by brand. Product titles often carry the brand name; scrub it out to get a clean brand name. Prefer brands with steady review velocity or a launch in the last 90 days.

STEP 2: PRE-SCREEN
Scores come only from facts you verified, and a missing fact counts as "no gap". On 2026-10-16 a run that only read listing text scored every brand 9-19, so none qualified for an audit. Verify these for each brand's best-selling ASIN, about 3 Helium10 calls per brand:
1. `retrieve_listing_by_asin` (1 call): titleWeak (missing key terms, keyword-stuffed or unclear), imageCount (count the image URLs), hasAPlus (true or false if the response shows A+ / enhanced content; leave it out if it doesn't say), rating, reviewCount. Amazon blocks direct page fetches, so don't WebFetch amazon.com.
2. `analyze_product_images` on the main image (1 call): mainImageWeak = true if it flags clutter, low resolution, poor framing or the product not filling the frame.
3. `get_asin_bsr_history` for the last 90 days (1 call): bsrChange90dPct = % change from 90 days ago to now (positive = the rank number went up = losing share). If it rose more than 20%, check `get_asin_price_history` for a price jump or a gap that looks like a stockout. If one of those explains it, or it's clearly seasonal, set bsrDropExplained: true.
4. Web search, which costs no Helium10 calls:
   - onWalmart: search "<brand> walmart.com". Set it to false only if you looked and they aren't selling there.
   - onTikTokShop: search "<brand> TikTok Shop". Same rule.
   - fundingWithin90d / launchWithin90d: search for news from the last 90 days.
Leave a field out entirely if you didn't verify it. A wrong value scores a gap that doesn't exist, so never guess.

STEP 3: FIND THE DECISION-MAKER
Contacts are optional, but **the brand's website is essential**, and it must be one you confirmed with a web search in this run, never one from memory (a wrong domain means Apollo finds nobody or the wrong company): right after you post, the server looks up a verified email with Apollo from the website's domain, and a brand with no verified email is never audited or contacted. Post the brand even if you find nobody. Find the founder, CEO, owner or director of ecommerce. Record full name, title, LinkedIn URL and the brand's Instagram handle. For email: only set emailVerified: true if a verifier confirmed it. A guessed pattern (first@brand.com) is emailVerified: false. Add one short personal detail per contact (a podcast they were on, a post, their background).

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
