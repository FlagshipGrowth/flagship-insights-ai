---
name: amazon-seo-listing
description: Generates Amazon-compliant Title, Bullet Points, and Backend Search Terms for a brand's product using Helium10 + Data Dive keyword research, then posts the draft to the brand's Slack channel tagging the account manager for review. Use when someone asks Claude to write, draft, or optimize an Amazon listing / title / bullets / backend search terms for a Flagship Growth brand's product.
---

# Amazon SEO Listing Agent

Generates a compliant Amazon listing (Item Name, Item Highlights/Bullets, Backend Search Terms) for one product, following Flagship Growth's SEO SOP, and hands it off in Slack for account-manager review before it goes to the client. Do not skip the compliance self-check at the end — a rule violation here risks the client's listing getting suppressed or AI-rewritten by Amazon.

## Required inputs

Before starting, confirm you have all three. If any are missing, ask for them instead of guessing:

- **Product name**
- **SKU** (and ASIN, if the product is already live on Amazon)
- **Link to the brand's website product page** (for brand voice, USPs, and any detail not yet on Amazon)

Also confirm **which brand's Slack channel** this is for, and **who the account manager is** — if you don't already know, ask, or check the brand's page in the internal portal (`/internal/brand/[brandId]`) for the assigned account manager and Slack channel ID.

## Tools

- **Data Dive MCP** (`create_niche_dive`, `get_dive_status`, `list_niches`, `get_niche_keywords`, `get_niche_roots`, `get_niche_competitors`, `get_ranking_juice`, `generate_listing_copy`, `get_listing_copy_generation_status`, `get_quota`) — niche/keyword research, ranking-juice scoring, and AI-drafted listing copy.
- **Helium10 MCP** — reverse-ASIN keyword lookup and listing lookup for already-live ASINs (`get_keywords_by_asin`, `retrieve_listing_by_asin`, `get_listing_details`), used to seed `currentListing` and cross-check keyword data against Data Dive's.

**Spend control — read before doing anything else:** `create_niche_dive` spends Dive tokens and `generate_listing_copy` spends an AI Copywriter prompt from `get_quota`'s monthly allowance — both are irreversible and **must not be retried** on error/timeout (poll `get_dive_status` / `get_listing_copy_generation_status` instead, per their own tool descriptions). Before spending either:
1. Call `get_quota` and confirm there's headroom (`DIVED_ASINS` / `AI_COPYWRITER_PROMPTS`). If it's tight, say so and ask before proceeding.
2. Call `list_niches` with `searchAsin` (if you have an ASIN) or `searchText` (the product's core keyword) first — this account already has hundreds of niches dived; reuse an existing one instead of spending a new dive token if a close match exists. If the existing niche's `latestResearchDate` looks stale relative to the request, `redive_niche` (`mode: same_competitors` to refresh as-is) is an option too — it also spends tokens and needs the same confirmation.
3. `create_niche_dive`, `redive_niche`, and `generate_listing_copy` all require `confirm: true` — only set it after telling the requester what the call will cost and getting an explicit go-ahead. Never retry any of the three on an error or timeout; poll their status tool instead.

## Procedure

### 1. Familiarize yourself with the product and brand — go beyond the one linked page

The single product page link is a starting point, not the whole job. Before drafting anything:
- Do a web/Google search on the brand name itself — how does it describe itself, what does it sell, what's it known for.
- Read the brand's **other website pages** too, not just the linked product: About/Story page, other products in the same line, any FAQ or sizing/materials page. The goal is to actually understand the brand and this product's real construction/positioning, not to extract one page's marketing copy in isolation.
- From all of this, identify: unique selling propositions (USPs), brand voice and tone, and — critically — **the actual style/category terms the brand itself uses for this product** (e.g. "fitted," "structured," "snapback," "dad hat," "trucker" are all different, non-interchangeable cap styles; get this from the brand's own words, not from a competitor's listing).

**Cross-check this against whatever Data Dive's `generate_listing_copy` (step 4) comes back with.** Its draft is built from the *niche's* competitors, some of whom may sell a different sub-style than this exact product — it will confidently reuse whatever category language is common in that niche even if it doesn't match this specific product. Concretely: if the brand's own material describes the product as "structured"/"fitted" and Data Dive's draft calls it a "dad hat" (a distinctly *unstructured*, curved-brim style), that's a real inaccuracy to catch and fix here, not a stylistic nitpick — don't let a generated draft's category framing override what the brand's own pages actually say the product is.

### 2. Get or create the niche
- Search first: `list_niches` with `searchAsin` (competitor/own ASIN, if known) or `searchText` (product's core keyword).
- If nothing close exists, pick a strong seed ASIN (the product's own ASIN if live, otherwise a representative top competitor found via Helium10) and run `create_niche_dive` (marketplace, asin, numberOfCompetitors ≥ 2 — more competitors gives a deeper read but costs more) — after the spend-control confirmation above.
- Poll `get_dive_status` with the returned `diveId` until `success`, then use its `nicheId` for everything below.

### 3. Research the niche
Pull all four for the niche:
- `get_niche_keywords` — master keyword list: search volume, relevancy, competitor organic ranks
- `get_niche_roots` — highest-impact word roots by broad search volume, for prioritizing what earns a place in Title/Highlights
- `get_niche_competitors` — competitor ASINs, titles, BSR, price, ratings, and their overall Ranking Juice, for niche saturation and positioning
- `get_ranking_juice` — per-competitor breakdown of what's actually driving their ranking (title/bullets/description contributions), and the niche's `optimizedListing` target — this is the "ranking juice" the SOP wants you to optimize toward

If the product is already live (you have an ASIN): also pull its current keywords/rank via Helium10's reverse-ASIN lookup, and its live content via `retrieve_listing_by_asin`/`get_listing_details` to use as `currentListing` in step 4.

**Refine to a working keyword list**: from `get_niche_keywords` + `get_niche_roots`, keep only keywords that are genuinely usable — filter out anything low-volume, irrelevant, or that doesn't earn its place given the 75-character Title budget. This is what step 4/6 draw from.

### 4. Generate the draft via Data Dive's AI Copywriter
Call `generate_listing_copy` with:
- `nicheId` from step 2
- `currentListing`: the live listing's title/description/bullets if the product is live (from step 3); otherwise a best-effort stub built from the product name, website USPs, and category — it still needs *something* to rewrite from
- `strategy`: default to `cosmo-rufus` (targets Amazon's relevance model *and* Rufus, covering this SOP's step 5 below in the same pass) unless the requester asks for a different one (`cosmo`, `ranking-juice`, `nlp`)
- After the spend-control confirmation above (`confirm: true`)

Poll `get_listing_copy_generation_status` (free, no extra cost) until `complete`, then take its `result.title`, `result.bullets`, `result.description`, `result.itemHighlights`, and `result.rankingJuice` as your working draft. Data Dive's own writer doesn't know Amazon's content-policy rules (Section 7 below) or write Backend Search Terms — that's still on you in steps 6–7.

### 5. Rufus AI FAQ check
- If the product is live: open its Amazon listing and check the Rufus AI FAQ widget on the product detail page for commonly asked questions.
- If not live yet: check the top competitor's listing's Rufus FAQs instead.
- Make sure the bullets/description address the real questions shoppers are asking, where relevant — adjust the draft from step 4 if something important is missing. (`cosmo-rufus` should already lean this way, but verify against the actual live widget rather than trusting the strategy name alone.)

### 6. Build the final output

Starting from Data Dive's draft (step 4), reconcile it against the working keyword list (step 3) and finalize the four fields below — in this order: Item Name → Item Highlights → Bullet Points → Backend Search Terms. De-duplicate keywords across every field below; nothing needs to be indexed twice, and backend terms exist specifically to catch words *not* already used elsewhere.

#### A. Item Name (Title) — hard limit 75 characters including spaces — always produce TWO

**Always generate two distinct, independently compliant titles, labeled Title A and Title B, for the account manager to A/B test.** Never hand off just one. Vary the actual approach between them (different keyword priority, different attribute emphasis, or a different one of the high-value keyword slots) rather than a trivial reword — two titles that only differ by word order aren't a meaningful test.
- **Title A**: from Data Dive's `generate_listing_copy` result (step 4), reconciled per the rules below.
- **Title B**: a second compliant option built by you from the same niche research (step 3) — either a second `generate_listing_copy` call with a different `strategy` (costs one more AI Copywriter prompt — confirm the cost first, same as any other spend) or a manually-built alternative emphasizing a different keyword/attribute priority at no extra Data Dive cost. Default to the manual option unless the requester asks for a second AI-generated variant.
- Run **both** titles through every check below and in the Section 7 compliance self-check independently — a passing Title A doesn't excuse a non-compliant Title B.

Priority order for each, fitting as much as matters in ~75 chars:
1. Brand name (required — must appear)
2. Product/model name
3. Key variating attribute(s) that distinguish this ASIN from sibling variants (size, count, flavor, color, etc.)
4. One or two high-value keywords (primary use case or category term)

If attributes don't all fit, push the overflow to Item Highlights rather than truncating mid-word or dropping the limit check.

Formatting:
- Title Case (capitalize each word; leave articles/conjunctions/prepositions under 4 letters lowercase — "and," "or," "for," "with," "the," "in")
- Numerals, not spelled-out numbers ("2" not "Two")
- "and" not "&" (unless "&" is part of the actual registered brand/trademark)
- No ALL CAPS (except a legitimate brand acronym)

#### B. Item Highlights — hard limit 125 characters
Overflow attributes from Item Name, plus materials, use cases, secondary attributes, and comparison detail that helps a shopper choose between variants. Same formatting rules as Item Name.

#### C. Bullet Points — minimum 3 (5 is typical)
Each bullet:
- Format: `ALL-CAPS HEADER – Description`, where the header is 3–6 words in ALL CAPS, followed by an em dash "–", followed by a sentence-fragment description in normal casing. (This project deliberately follows Amazon's own published example format here, not the literal "Header: colon" text in Amazon's style guide — see rules doc for why. The ALL-CAPS allowance applies **only** to the header, never the description.)
- Starts with a capital letter, no terminal punctuation (no period/exclamation/question mark at the end)
- Sentence fragments, not full grammatical sentences; semicolons may separate distinct phrases within one bullet
- One distinct feature/benefit per bullet — never repeat information across bullets, Title, or Description
- Spell out numbers one–nine in prose ("three," "seven") — except in model numbers and measurements, which stay numeric
- Measurements: space between digit and unit ("60 ml," not "60ml")
- Confirm the actual character limit for this product's category/type before finalizing — it varies by category, don't assume a fixed number
- Never include: fabric content, care instructions, or country of origin (these belong in their own listing fields, not bullets)
- Never include: subjective/comparative claims ("best," "strongest") unless verifiable on packaging; competitor comparisons; cross-sell references to other ASINs; unsubstantiated awards/survey claims

#### D. Backend Search Terms — one flat string, byte limit **249 bytes** (confirmed 2026-09-12 — Amazon has changed this before, so re-confirm in Seller Central if this instruction is old). **Target range: 235–249 bytes.** Landing under 235 means the candidate pool wasn't mined hard enough — go back and widen it (see step 3 below) before accepting a shorter result.

**The most obvious words are the ones you must *not* include, and it's easy to get this backwards.** The brand name and the bare category noun (e.g. "hat," "cap") are exactly the terms it's tempting to add because they feel like the most important, most "obvious" ones for this product — but they're already sitting in the Title, already indexed there, and Amazon's own guidance is explicit that backend terms exist to catch words *not* already used elsewhere. Repeating them here doesn't add reach, it just burns byte budget that a genuinely new term could have used. Before doing anything else, write down every word already in your finalized Title A, Title B, Highlights, and Bullets — that whole set (brand name included) is off-limits for this field, full stop.

**Fill toward the 235–249 target — don't stop at a handful of "obviously good" words.** Work the full pipeline before finalizing:
1. Build a wide candidate pool: pull individual words out of `get_niche_keywords`'s actual keyword phrases (not just `get_niche_roots`'s pre-extracted single-word roots — mine the raw keyword list too, since real candidate words hide inside multi-word phrases that root extraction can miss or under-rank) and combine with `get_niche_roots`, ranked by search volume/relevancy.
2. Filter: drop the off-limits set from directly above, stopwords, words that misrepresent the actual product (an attribute or style it doesn't really have — e.g. don't add "adjustable" or "snapback" for a fitted-only cap, or a color the specific SKU/variant isn't, just because they're high-volume; accuracy beats byte-filling), invented misspellings, and duplicate singular/plural forms (keep only the one with the real confirmed higher search volume).
3. **Prioritize English-language terms.** Rank the filtered English candidates by search volume and fill toward 235–249 bytes from that list first. Only bring in other-language terms (real, verified alternate-language search terms — see the rule below) if genuine English candidates run out before you reach 235 bytes; don't let non-English terms crowd out an English one with real search volume just because it happened to rank higher in the raw data.
4. Keep adding, recomputing the running UTF-8 byte length (single space between each word) after every addition, until the next candidate would push the total over 249 — then stop. If you hit 235–249, good. If you can't get past ~150–200 using only genuinely accurate, non-redundant candidates, say so explicitly and explain what's missing from the research (a thin niche dive, a very narrow product) rather than padding with low-confidence filler to hit the number.
5. State the final byte count explicitly when you hand this off (e.g. "241/249 bytes") so the account manager can see how much of the budget was actually used.

Other rules, unchanged:
- All lowercase, space-separated, no punctuation (no commas/semicolons/dashes)
- No word repeated; no word that already appears in Title/Highlights/Bullets
- Pick one form per word — singular OR plural, not both (prefer whichever form the research shows more search volume for)
- Strip stopwords: "a," "an," "and," "by," "for," "of," "the," "with"
- Include real synonyms, abbreviations, alternate-language terms, and genuine alternate spellings a shopper might search, as long as they're backed by actual search volume in the research — never invent common misspellings or add a plausible-sounding term with no data behind it
- Flag if this product type is one of Amazon's 23 types where this field is *required*, not optional (bath toy, body paint, bath pillow, bath safety seating, bar tool set, bathroom container set, bathtub shower mat, broom, bookend, bed skirt, artificial tree, body positioner, bedding set, body deodorant, balloon, bed linen, board game, bed linen set, blanket, body care product, beauty, art and craft supply, party favor) — an empty field here for one of these is a compliance gap, say so explicitly.

## 7. Compliance self-check — do this explicitly, in order, before posting anything

Go through every check below against your own draft. If anything fails, fix it and re-check — don't post a draft that fails any of these:

**Universal (Title + Highlights + Bullets):**
- No promotional/subjective language: "free shipping," "sale," "best seller," "#1," "guaranteed," "100% quality," "best," "top-rated," any unverifiable superlative
- No pricing, quantity claims unrelated to actual pack count, or availability language ("in stock," "limited time")
- No seller name or non-brand company name
- No special characters: `! * $ ? _ { } # < > | ; ^ ~` (basic punctuation — commas, hyphens, parentheses, "/" — is fine in moderation)
- No medical/health claims not approved for the category (especially supplements)
- No competitor brand names or comparisons
- No emojis or decorative symbols
- No guarantee/warranty language unless it's an approved, factual warranty statement
- No keyword stuffing — every token in the Title especially must earn its place

**Title specifically — check both Title A and Title B independently:**
- Exact character count ≤ 75 (count it, don't estimate)
- Brand name token present

**Highlights specifically:**
- Exact character count ≤ 125

**Bullets specifically:**
- At least 3 bullets
- Each starts with a capital letter, ends with no terminal punctuation
- Each opens with an ALL-CAPS header (3–6 words) + em dash, description in normal casing, no other ALL-CAPS runs after the dash
- No ASIN strings (pattern like `B00XXXXXXX`) anywhere
- No `™ ® € … † ‡ ¢ £ ¥ © ± ~` or emoji
- No placeholder text ("not applicable," "n/a," "TBD," "copy pending")
- No abbreviations ("qty," "pkg," "w/," "approx.") — spell them out
- No fabric/care/country-of-origin content
- No URLs, emails, phone numbers, or other external contact info
- No near-duplicate content between bullets, or with Title/Highlights

**Backend Search Terms specifically:**
- Byte length (UTF-8), not character length — target 235–249 bytes; if it's meaningfully under that, the candidate pool wasn't mined widely enough (see step 6D)
- Brand name and the bare category noun (e.g. "hat"/"cap") are not present — they're already in the Title, and including them here is the single most common mistake to avoid
- English-language terms are prioritized; other-language terms only appear because genuine English candidates ran out first
- All lowercase, no punctuation
- No word repeated; no word already used in Title/Highlights/Bullets
- No stopwords ("a," "an," "and," "by," "for," "of," "the," "with")
- No brand names (yours or competitors'), no ASINs, no profanity
- No temporary/time-based claims: "new," "available now," "just launched," "last chance," "limited time," "on sale," "this week/month/year," "today," etc.
- No subjective claims: "amazing," "best," "cheap," "effective," "fastest," "popular," "trending," etc.
- No offensive content of any kind
- This field is **higher-risk** than Title/Bullets — a violation here can get the ASIN suppressed, not just edited. Treat any hit as a hard blocker, never a "probably fine."

If you're not fully certain whether a candidate word or phrase is compliant, leave it out rather than guess — the risk (AI-rewrite, listing edit, or ASIN suppression) is asymmetric.

## 8. Hand off for review

Post to the brand's Slack channel (from the channel/brand context, or ask if unknown). Always include, every time:

- **Both Title A and Title B**, each labeled and each with its character count (e.g. "64/75 chars"), so the account manager can pick or run both as an A/B test
- Item Highlights, with its character count
- All Bullet Points
- The Backend Search Terms string, with its **byte count out of 249** (e.g. "231/249 bytes")
- **The Ranking Juice score** from `generate_listing_copy`'s `result.rankingJuice` (or from `get_ranking_juice` if working from a manual draft) — report the number itself, and where useful, how it compares to the niche's strongest competitor from `get_niche_competitors`/`get_ranking_juice` so the account manager has a sense of scale, not just a bare figure
- The product name, SKU, and ASIN (if any) this is for
- A one-line note on what changed / why these keywords, if useful context
- **Tag the brand's assigned account manager by name**, and ask them to review before it goes to the client — this is a draft for their approval, not a finished submission. Do not contact the client directly.

Do not mark this "done" — the account manager still needs to review and approve before anything reaches the brand.
