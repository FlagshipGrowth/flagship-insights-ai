---
name: amazon-seo-listing
description: Generates Amazon-compliant Title, Item Highlights, Bullet Points, Product Description, Backend Search Terms, and Alt Text for a brand's product using Helium10 + Data Dive keyword research, writes the result into that brand's shared Google Sheet, and posts the link to the brand's Slack channel tagging the account manager for review. Use when someone asks Claude to write, draft, or optimize an Amazon listing / title / bullets / backend search terms for a Flagship Growth brand's product.
---

# Amazon SEO Listing Agent

Generates a compliant Amazon listing for one product, following Flagship Growth's SEO SOP, and delivers it as a row in that brand's shared Google Sheet, with a short Slack notification for account-manager review before it goes to the client. Do not skip the compliance self-check at the end — a rule violation here risks the client's listing getting suppressed or AI-rewritten by Amazon.

**A request is not complete until a real Google Sheet has actually been created or updated via the Google Drive connector.** A Slack reply containing the draft text is not a substitute for this, even if it looks complete — it is a status update at best. If you finish your research and drafting and are about to reply in Slack, stop and check: did I actually call a Drive tool that created or edited a spreadsheet? If not, do that now, before replying. This has been missed before — treat it as the step most likely to get skipped, not an optional nice-to-have.

## Required inputs

Before starting, confirm you have all four. If any are missing, ask for them instead of guessing:

- **Product name**
- **SKU** (blank/"not assigned yet" if none exists)
- **ASIN** (blank/"not live yet" if the product isn't live on Amazon yet)
- **Link to the brand's website product page** (for brand voice, USPs, and any detail not yet on Amazon)

Also confirm **which brand's Slack channel** this is for, and **who the account manager is**. There are two equally valid ways this request reaches you — figure out which one you're in, since it changes how you reply (Section 9) but nothing about the actual research/drafting work:

**A) Via `/seo-listing` — Flagship AI's Slack app posts one message per request, @-mentioning you**, and that message already carries everything above: product name, SKU (or "not assigned yet"), website URL, priority, the account manager's name, and a task ID (e.g. "task 4f2a..."). Read it from there rather than asking again. You have no access to this app's internal portal or database, so you can't look anything up yourself if it's missing — if the message is genuinely incomplete, ask in the same thread rather than guessing or trying to browse `/internal/brand/[brandId]` (you can't sign into it). Reply **in that same thread** when you're done (see Section 9) — Flagship AI is watching for your reply there and logs it onto the tracked dashboard task automatically; posting anywhere else means the request never shows as handled there.

- **Bulk requests look the same, just with a list.** A bulk CSV upload (many SKUs at once) still posts as one message with one task ID — but the message lists multiple products (name, SKU, priority) instead of one, sometimes noting more rows than are listed inline (the rest are on the tracked task's description, not in Slack). Work through **every** listed product as its own full run of this procedure (own niche dive, own sheet tab, own Ranking Juice pull — color/variant-only shortcuts in Section 1/6 still apply where they genuinely match) — don't treat the list as one combined product. Then post **one single reply** for the whole batch when every product in the list is done (Section 9, step 4), not one reply per product — there's only one thread and one task ID for the entire batch.

**B) Direct — someone just @-mentions you in a brand's channel** (or DMs you) asking for a listing, with no `/seo-listing` message involved at all. **This is a fully supported, first-class way to trigger this skill, not a fallback** — the whole point is letting anyone get a listing drafted without needing the dashboard at all.

**Always ask for the four required inputs above first, as your very first reply, before doing anything else** — before any site crawl, before `get_quota`, before any Data Dive/Helium10 call. Even if the @-mention looks complete, restate what you read and ask them to confirm/fill the rest in one message, e.g.: *"Got it — [Product name], SKU [x], [URL]. What's the ASIN (or is it not live yet)? And who's the account manager for this?"* Only start the actual procedure once they've replied confirming or supplying the missing pieces. This is a deliberate two-step exchange, not a one-shot — a stray or partial mention shouldn't trigger real work (research time, and real Data Dive/Helium10 spend) before someone's actually confirmed they want it. This is the one thing that's genuinely different from path A, not the reply format — once inputs are confirmed, do the full procedure exactly the same way (research, niche dive, Ranking Juice, sheet write). Also confirm the account manager the same way if it's not obvious from who's asking.

The only other real differences from path A: **there is no task ID and nothing to log onto a dashboard task** — don't invent one, don't say "task" in your reply, and don't try to reach `/internal/brand/[brandId]` (still no access). Reply in the same thread the request came in (or start one on the original message if it wasn't already threaded) — see Section 9's direct-request reply format.

## Tools

- **Data Dive MCP** (`create_niche_dive`, `get_dive_status`, `list_niches`, `get_niche_keywords`, `get_niche_roots`, `get_niche_competitors`, `get_ranking_juice`, `generate_listing_copy`, `get_listing_copy_generation_status`, `get_quota`) — niche/keyword research, ranking-juice scoring, and AI-drafted listing copy.
- **Helium10 MCP** — reverse-ASIN keyword lookup and listing lookup for already-live ASINs (`get_keywords_by_asin`, `retrieve_listing_by_asin`, `get_listing_details`), used to seed `currentListing` and cross-check keyword data against Data Dive's.
- **Google Drive connector** (covers Sheets) — where the finished draft actually lives (Section 9). Find or create the brand's sheet, add/rename a tab, and write the content into it.

**Spend control:** `create_niche_dive` spends Dive tokens and `generate_listing_copy` spends an AI Copywriter prompt from `get_quota`'s monthly allowance — both are irreversible and **must not be retried** on error/timeout (poll `get_dive_status` / `get_listing_copy_generation_status` instead, per their own tool descriptions). **A `/seo-listing` request is itself the authorization to spend, every single time. Never stop and ask permission before calling `create_niche_dive`, `redive_niche`, or `generate_listing_copy` — just do it.** This isn't a one-time-only allowance — it applies to every request, not just the first.
1. Call `get_quota` first. If a feature's remaining headroom is genuinely low (say, under 10% of capacity left), say so when you hand off the result, but still complete the request unless it's fully exhausted (0 remaining) — in that case, stop and explain you're out of quota rather than erroring out partway through.
2. **Default to a fresh `create_niche_dive` for every genuinely distinct product** — don't go hunting through `list_niches` for something that might loosely match; this account has hundreds of niches from unrelated past work, and reusing a mismatched one produces worse research than just diving fresh. The one exception is the color/variant-only case described in Section 1 and Section 6 — that's a real "skip the dive" case, not a general habit.
3. Never retry `create_niche_dive`, `redive_niche`, or `generate_listing_copy` on an error or timeout — poll their status tool instead. If a seed ASIN is rejected (e.g. "too weak to find competitors"), that's fine to correct and retry *with a different ASIN* — that's a new, deliberate call, not a blind retry of the same one.

## Procedure

### 1. Familiarize yourself with the product and brand — actually crawl the site, starting from the page you were given

**Start at the product URL in the request. Open it for real.** Then, from the links on that actual page, navigate to at least 2–3 more: the main nav/header (About, Our Story), any other product in the same line, and a FAQ/materials/sizing page if one's linked. This is a real, sequential crawl — open a page, read it, follow a link from it — not a single Google search standing in for all of it. A generic web search can supplement this (brand reputation, press, Shark-Tank-style background), but it never replaces actually opening the brand's own pages; a search result's summary of a page is not the same as reading the page.

**If a page fetch fails or is blocked** (a network/access restriction, not just a 404), say so explicitly in your reply rather than silently falling back to guessing from search snippets or Data Dive's own generated copy — an unreachable site is a real gap to flag, not something to paper over.

From what you actually read, identify: unique selling propositions (USPs), brand voice and tone, and — critically — **the actual style/category terms the brand itself uses for this product** (e.g. "fitted," "structured," "snapback," "dad hat," "trucker" are all different, non-interchangeable cap styles; get this from the brand's own words, not from a competitor's listing). This is exactly what answers questions like "is this actually a fitted cap or a dad hat" — a question you should be able to answer from the brand's own pages, not from inference.

**Cross-check this against whatever Data Dive's `generate_listing_copy` (step 4) comes back with.** Its draft is built from the *niche's* competitors, some of whom may sell a different sub-style than this exact product — it will confidently reuse whatever category language is common in that niche even if it doesn't match this specific product. Concretely: if the brand's own material describes the product as "structured"/"fitted" and Data Dive's draft calls it a "dad hat" (a distinctly *unstructured*, curved-brim style), that's a real inaccuracy to catch and fix here, not a stylistic nitpick — don't let a generated draft's category framing override what you actually read on the brand's own pages.

**Exception — color/variant-only requests:** if this request is for a product you've already fully researched and drafted for this brand (same product, same construction, only the color/variant differs — check the brand's Google Sheet for an existing tab on the same base product first), you don't need to re-crawl the site or redo steps 2–5 from scratch. Skip straight to reusing that research and drafting (see the note in Section 6) — just make sure the new color is actually reflected in Title/Highlights/Backend Search Terms, and still pull a fresh Ranking Juice number (Section 3) for this specific SKU before delivering.

### 2. Get or create the niche
- **Color/variant-only request** (Section 1 exception): reuse the `nicheId` from the earlier request for the same base product — no new dive. Skip to Section 6's shortcut.
- **Otherwise, dive fresh — this is the default, not a fallback.** Pick a strong seed ASIN (the product's own ASIN if live, otherwise a representative top competitor found via Helium10) and run `create_niche_dive` (marketplace, asin, numberOfCompetitors ≥ 2 — more competitors gives a deeper read but costs more).
- Poll `get_dive_status` with the returned `diveId` until `success`, then use its `nicheId` for everything below. If the seed ASIN is rejected as too weak, pick a different one and dive again (a new, deliberate call — not a retry).

### 3. Research the niche
Pull all four for the niche:
- `get_niche_keywords` — master keyword list: search volume, relevancy, competitor organic ranks
- `get_niche_roots` — highest-impact word roots by broad search volume, for prioritizing what earns a place in Title/Highlights
- `get_niche_competitors` — competitor ASINs, titles, BSR, price, ratings, and their overall Ranking Juice, for niche saturation and positioning
- `get_ranking_juice` — per-competitor breakdown of what's actually driving their ranking (title/bullets/description contributions), and the niche's `optimizedListing` target — this is the "ranking juice" the SOP wants you to optimize toward

**Keep your working notes from this step — don't discard them once step 4 is done.** The top 3–5 competitors you pull here (ASIN, title, and which specific keyword(s) each one is winning on that you incorporated into this draft) go into the sheet as a real, reviewable Competitor Snapshot (Section 9), not just internal scratch work. Note as you go which competitor(s) each keyword you adopt actually came from, so you can cite it later instead of reconstructing the reasoning after the fact.

If the product is already live (you have an ASIN): also pull its current keywords/rank via Helium10's reverse-ASIN lookup, and its live content via `retrieve_listing_by_asin`/`get_listing_details` to use as `currentListing` in step 4 **and** as the "Current Content" column in the sheet (Section 9) — if it's not live yet, the "Current" side of the sheet is simply left blank/marked "Not live yet."

**Refine to a working keyword list**: from `get_niche_keywords` + `get_niche_roots`, keep only keywords that are genuinely usable — filter out anything low-volume, irrelevant, or that doesn't earn its place given the 75-character Title budget. This is what step 4/6 draw from.

### 4. Generate the draft via Data Dive's AI Copywriter
Call `generate_listing_copy` with:
- `nicheId` from step 2
- `currentListing`: the live listing's title/description/bullets if the product is live (from step 3); otherwise a best-effort stub built from the product name, website USPs, and category — it still needs *something* to rewrite from
- `strategy`: default to `cosmo-rufus` (targets Amazon's relevance model *and* Rufus, covering this SOP's step 5 below in the same pass) unless the requester asks for a different one (`cosmo`, `ranking-juice`, `nlp`)

Poll `get_listing_copy_generation_status` (free, no extra cost) until `complete`, then take its `result.title`, `result.bullets`, `result.description`, `result.itemHighlights`, and `result.rankingJuice` as your working draft. Data Dive's own writer doesn't know Amazon's content-policy rules (Section 8 below) or write Backend Search Terms or Alt Text — that's still on you in steps 6–8.

### 5. Rufus AI FAQ check
- If the product is live: open its Amazon listing and check the Rufus AI FAQ widget on the product detail page for commonly asked questions.
- If not live yet: check the top competitor's listing's Rufus FAQs instead.
- Make sure the bullets/description address the real questions shoppers are asking, where relevant — adjust the draft from step 4 if something important is missing. (`cosmo-rufus` should already lean this way, but verify against the actual live widget rather than trusting the strategy name alone.)

### 6. Build the final output

Starting from Data Dive's draft (step 4), reconcile it against the working keyword list (step 3) and finalize every field below, in this order: Item Name → Item Highlights → Bullet Points → Product Description → Backend Search Terms → Alt Text. De-duplicate keywords across every field; nothing needs to be indexed twice, and Backend Search Terms specifically exists to catch words *not* already used elsewhere.

**Color/variant-only shortcut:** if Section 1/2 identified this as just a new color of an already-drafted product, don't rebuild everything from scratch — take the existing Title A/B, Highlights, Bullets, Description, and Backend Search Terms from that earlier tab and:
- Swap the color token wherever it appears (Title, Highlights, and add it to Backend Search Terms if it isn't implicitly covered — a color word is exactly the kind of new, non-duplicated term that field exists for).
- Leave everything else as-is; don't reopen the full compliance pass on content that didn't change, just re-check whatever you actually edited.
- **Still call `get_ranking_juice` for this specific SKU and report a real number** — never skip or reuse the old color's Ranking Juice figure, and never omit it. This applies regardless of which path you took to get here; Ranking Juice is a required part of every single delivery, full stop, not just requests that ran the full pipeline.

#### A. Item Name (Title) — hard limit 75 characters including spaces — always produce TWO

**Always generate two distinct, independently compliant titles, labeled Title A and Title B, for the account manager to A/B test.** Never hand off just one. Vary the actual approach between them (different keyword priority, different attribute emphasis, or a different one of the high-value keyword slots) rather than a trivial reword — two titles that only differ by word order aren't a meaningful test.
- **Title A**: from Data Dive's `generate_listing_copy` result (step 4), reconciled per the rules below.
- **Title B**: a second compliant option built by you from the same niche research (step 3) — either a second `generate_listing_copy` call with a different `strategy` or a manually-built alternative emphasizing a different keyword/attribute priority at no extra Data Dive cost. Default to the manual option unless the requester asks for a second AI-generated variant.
- Run **both** titles through every check below and in the Section 8 compliance self-check independently — a passing Title A doesn't excuse a non-compliant Title B.

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
- Format: `ALL-CAPS HEADER – Description`, where the header is 3–6 words in ALL CAPS, followed by an em dash "–", followed by a sentence-fragment description in normal casing. (This project deliberately follows Amazon's own published example format here, not the literal "Header: colon" text in Amazon's style guide. The ALL-CAPS allowance applies **only** to the header, never the description.)
- Starts with a capital letter, no terminal punctuation (no period/exclamation/question mark at the end)
- Sentence fragments, not full grammatical sentences; semicolons may separate distinct phrases within one bullet
- One distinct feature/benefit per bullet — never repeat information across bullets, Title, or Description
- Spell out numbers one–nine in prose ("three," "seven") — except in model numbers and measurements, which stay numeric
- Measurements: space between digit and unit ("60 ml," not "60ml")
- Confirm the actual character limit for this product's category/type before finalizing — it varies by category, don't assume a fixed number
- **Fill toward that confirmed limit — target at least 90% of it per bullet.** A bullet that lands well under the limit is under-optimized, not "concise" — Amazon's own ranking weight rewards fuller field usage, and a short bullet is wasted allowance a competitor's fuller one will out-rank. If a bullet comes in short, go back and add genuine, specific detail (a real use case, a material spec, a sizing note, an answer to a Rufus FAQ from Section 5) rather than accepting it as done — never pad with filler or repeat something already said elsewhere just to hit the number. Record each bullet's character count against its limit (e.g. "228/250") in the sheet's Char/Byte Count column (Section 9) so this is checkable at a glance, and treat any bullet noticeably under 90% as a draft still in progress, not delivered.
- Never include: fabric content, care instructions, or country of origin (these belong in their own listing fields, not bullets)
- Never include: subjective/comparative claims ("best," "strongest") unless verifiable on packaging; competitor comparisons; cross-sell references to other ASINs; unsubstantiated awards/survey claims

#### D. Product Description
Data Dive's `result.description` is your starting point. Same universal compliance rules as Title/Bullets apply (Section 8) — no promotional language, no prohibited claims, no competitor mentions. Unlike bullets, full sentences/paragraphs are fine here. Don't just restate the bullets verbatim — this is where a bit more brand voice and narrative context belongs, but stay factual.

#### E. Backend Search Terms — one flat string, byte limit **249 bytes** (confirmed 2026-09-12 — Amazon has changed this before, so re-confirm in Seller Central if this instruction is old). **Target range: 235–249 bytes.** Landing under 235 means the candidate pool wasn't mined hard enough — go back and widen it (see below) before accepting a shorter result.

**The most obvious words are the ones you must *not* include, and it's easy to get this backwards.** The brand name and the bare category noun (e.g. "hat," "cap") are exactly the terms it's tempting to add because they feel like the most important, most "obvious" ones for this product — but they're already sitting in the Title, already indexed there. Repeating them here doesn't add reach, it just burns byte budget a genuinely new term could have used. Before doing anything else, write down every word already in your finalized Title A, Title B, Highlights, Bullets, and Description — that whole set (brand name included) is off-limits for this field, full stop.

**Fill toward the 235–249 target:**
1. Build a wide candidate pool: pull individual words out of `get_niche_keywords`'s actual keyword phrases (not just `get_niche_roots`'s pre-extracted single-word roots — mine the raw keyword list too, since real candidate words hide inside multi-word phrases that root extraction can miss or under-rank) and combine with `get_niche_roots`, ranked by search volume/relevancy.
2. Filter: drop the off-limits set from directly above, stopwords, words that misrepresent the actual product (an attribute or style it doesn't really have — e.g. don't add "adjustable" or "snapback" for a fitted-only cap, or a color the specific SKU/variant isn't, just because they're high-volume; accuracy beats byte-filling), invented misspellings, and duplicate singular/plural forms (keep only the one with the real confirmed higher search volume).
3. **Prioritize English-language terms.** Rank the filtered English candidates by search volume and fill toward 235–249 bytes from that list first. Only bring in other-language terms (real, verified alternate-language search terms) if genuine English candidates run out before you reach 235 bytes.
4. Keep adding, recomputing the running UTF-8 byte length (single space between each word) after every addition, until the next candidate would push the total over 249 — then stop. If you can't get past ~150–200 using only genuinely accurate, non-redundant candidates, say so explicitly and explain what's missing from the research rather than padding with low-confidence filler.
5. Record the final byte count (e.g. "241/249 bytes") — it goes in the sheet's Char Count column for this row.

Other rules, unchanged:
- All lowercase, space-separated, no punctuation (no commas/semicolons/dashes)
- No word repeated; no word that already appears in Title/Highlights/Bullets/Description
- Pick one form per word — singular OR plural, not both (prefer whichever form the research shows more search volume for)
- Strip stopwords: "a," "an," "and," "by," "for," "of," "the," "with"
- Include real synonyms, abbreviations, alternate-language terms, and genuine alternate spellings a shopper might search, as long as they're backed by actual search volume in the research — never invent common misspellings or add a plausible-sounding term with no data behind it
- Flag if this product type is one of Amazon's 23 types where this field is *required*, not optional (bath toy, body paint, bath pillow, bath safety seating, bar tool set, bathroom container set, bathtub shower mat, broom, bookend, bed skirt, artificial tree, body positioner, bedding set, body deodorant, balloon, bed linen, board game, bed linen set, blanket, body care product, beauty, art and craft supply, party favor) — an empty field here for one of these is a compliance gap, say so explicitly.

#### F. Alt Text (A+ Content images) — only if the brand has (or is actively building) A+ Content for this product; otherwise skip this field and say why
Researched from general SEO/accessibility guidance, not Amazon's own primary documentation — flagged as such, re-verify if it matters for a specific edge case:
- **100 characters max** per image's alt text
- **No punctuation** at all (no commas, hyphens, apostrophes)
- **No promotional/restricted language** — same blocklist as Title/Bullets/Description (no "best," "free," "guaranteed," superlatives, etc.)
- **Unique per image** — no repeating the same alt text, or even the same keyword set, across multiple images in the same listing
- 1–2 keywords or a short descriptive phrase per image, objective and accurate to what's actually shown (colors, angle, use-in-context) — doesn't need to be a grammatically complete sentence
- If you don't know what each specific A+ Content image actually shows (you likely won't, working from a website product page alone), say so rather than inventing plausible-sounding descriptions — list this as an open item for whoever builds the A+ Content, not a guess dressed up as a deliverable.

#### G. Overall Ranking Juice — one rolled-up number for the whole listing, not just per-title

Every field above (Title, Bullets, Description, Backend Search Terms) gets its own Proposed Ranking Juice number in the sheet (Section 9) — but the account manager also needs a single "how good is this listing overall" figure, not just a column of separate numbers they have to average themselves.

- Compute it as the simple average of every field's Proposed Ranking Juice you recorded (Title A, Bullets, Description, Backend Search Terms — use Title A's number, not Title B's, since A is the primary recommendation; exclude any field you explicitly noted as un-scored per Section 9's "Proposed" rule).
- Do the same for the Current side wherever the product is live and has a Current Ranking Juice per field, so the two Overall numbers are directly comparable.
- Report both Overall numbers in a dedicated row at the **top** of the sheet tab (above the per-field rows), labeled "Overall Ranking Juice," using the same Current/Proposed columns as every other row.
- If the Overall Proposed number comes out lower than Overall Current, say so plainly in your Slack reply (one added sentence, per the exception in Section 9 step 4) rather than letting the AM discover it by reading the sheet — a listing that scores worse than what's already live needs to be flagged, not quietly delivered.

### 7. Compliance self-check — do this explicitly, in order, before writing anything to the sheet

Go through every check below against your own draft. If anything fails, fix it and re-check — don't deliver a draft that fails any of these:

**Universal (Title + Highlights + Bullets + Description):**
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
- Each bullet uses at least 90% of the confirmed category character limit — if not, go back and add real content (6C) before delivering, don't accept a short bullet
- Each starts with a capital letter, ends with no terminal punctuation
- Each opens with an ALL-CAPS header (3–6 words) + em dash, description in normal casing, no other ALL-CAPS runs after the dash
- No ASIN strings (pattern like `B00XXXXXXX`) anywhere
- No `™ ® € … † ‡ ¢ £ ¥ © ± ~` or emoji
- No placeholder text ("not applicable," "n/a," "TBD," "copy pending")
- No abbreviations ("qty," "pkg," "w/," "approx.") — spell them out
- No fabric/care/country-of-origin content
- No URLs, emails, phone numbers, or other external contact info
- No near-duplicate content between bullets, or with Title/Highlights/Description

**Backend Search Terms specifically:**
- Byte length (UTF-8), not character length — target 235–249 bytes; if it's meaningfully under that, the candidate pool wasn't mined widely enough (see 6E)
- Brand name and the bare category noun (e.g. "hat"/"cap") are not present — they're already in the Title
- English-language terms are prioritized; other-language terms only appear because genuine English candidates ran out first
- All lowercase, no punctuation
- No word repeated; no word already used in Title/Highlights/Bullets/Description
- No stopwords ("a," "an," "and," "by," "for," "of," "the," "with")
- No brand names (yours or competitors'), no ASINs, no profanity
- No temporary/time-based claims: "new," "available now," "just launched," "last chance," "limited time," "on sale," "this week/month/year," "today," etc.
- No subjective claims: "amazing," "best," "cheap," "effective," "fastest," "popular," "trending," etc.
- No offensive content of any kind
- This field is **higher-risk** than Title/Bullets — a violation here can get the ASIN suppressed, not just edited. Treat any hit as a hard blocker, never a "probably fine."

**Alt Text specifically (if included):**
- ≤ 100 characters, no punctuation, no promotional language, unique per image

If you're not fully certain whether a candidate word or phrase is compliant, leave it out rather than guess — the risk (AI-rewrite, listing edit, or ASIN suppression) is asymmetric.

## 9. Deliver: write it into the brand's Google Sheet, then post the link in Slack

**The Google Sheet is the actual deliverable — the Slack reply is just a short pointer to it, not a dump of the full content.** Before you post anything in Slack, confirm both of these actually happened — if either didn't, go do it now rather than delivering an incomplete result:
- A real spreadsheet was created or updated via the Google Drive connector (not just planned or described).
- A real Ranking Juice number was pulled for this SKU and is going in the sheet — every request, including color/variant-only ones (Section 6).

1. **Find or create the brand's sheet.** Search Drive for a spreadsheet titled exactly `SEO-{BrandName}` (e.g. `SEO-Noggin Boss`). If it exists, use it — every request for this brand goes into the same spreadsheet, as new tabs, not a new file each time. Only create a new one (titled exactly `SEO-{BrandName}`) if none exists yet. **If you just created it, set sharing to "Anyone with the link" / Editor** via the Drive connector's share/permissions tool — this sheet needs to be editable by anyone on the team without a separate share request each time. **Confirm it actually took** by checking the file's permissions afterward (don't just assume the share call succeeded) — this has been skipped or silently failed before, leaving a brand-new sheet restricted to just you. If the sheet already existed, don't re-check this every request; it only needs doing once, at creation.
2. **Add a tab named exactly by SKU.** If there's no SKU yet, use the ASIN; if there's neither (a genuinely new, unlaunched product), use a short slug of the product name — but note in your Slack reply that the tab should be renamed once a SKU is assigned. **If you duplicate an existing tab as a starting template, rename it immediately** — never leave a tab named "Copy of X" or "Copy of Copy of X." Check the sheet's existing tab names first; if one already matches this SKU, update that tab rather than creating a duplicate.
3. **Lay out the tab** mirroring this structure — an Overall Ranking Juice summary row, then one row per field, then a Competitor Snapshot block, then the Current/Proposed comparison:

   | Field | Ranking Juice (Current) | Current Content | Char/Byte Count | Ranking Juice (Proposed) | Proposed Content | Approved by AM | Approved by Client | Feedback | Published |
   |---|---|---|---|---|---|---|---|---|---|

   **First row is always "Overall Ranking Juice"** (Section 6G) — Current/Proposed only, "Current Content"/"Proposed Content"/"Char/Byte Count" left blank for this row since it's a rollup, not a field. Then one row each for: Title A, Title B, Item Highlights, Bullet Point 1–N, Product Description, Backend Search Terms, Alt Text 1–N (if included). "Current" columns come from the live listing (Section 3) if the product is live — leave them blank with a note like "Not live yet" if it isn't. "Proposed" Ranking Juice comes from `result.rankingJuice` (step 4) for the fields Data Dive scored directly; for Title B and anything you built manually, note if you didn't re-score it separately rather than guessing a number.

   **"Approved by AM", "Approved by Client", and "Published" are checkboxes** (Google Sheets checkbox data validation on the cell, not plain text) — insert them as real checkboxes for every row in these three columns, unchecked by default. **"Feedback" is a plain text column**, left blank. Leave all four blank/unchecked — they're filled in by the account manager and client during review (see the note at the end of this section), never by you.

   **Below the field table, add a "Competitor Snapshot" block** — this is what actually informed the draft (Section 3), made visible instead of staying internal-only:

   | Competitor ASIN | Competitor Title | Their Ranking Juice | Keyword(s) You Adopted From Them |
   |---|---|---|---|

   List the 3–5 competitors from `get_niche_competitors` you actually drew from while finalizing Section 6 — not every competitor the research touched, just the ones that genuinely shaped a keyword or positioning choice in this draft, with which specific keyword(s) came from each (the notes from Section 3). If a competitor's data informed the research but nothing from them ended up adopted into the final draft, leave them out — this block is for what actually made it into the listing, not the full research dump.
4. **Reply in the Slack thread** (see Section 1 — same thread the request came in on) with **one short line, not a summary of the work**: a "complete" marker, an @-mention (or plain name) of the account manager, and a link to the sheet — plus the task ID, for the two trigger types that have one. Nothing else — no draft text, no field-by-field recap, no restating what's already in the trigger message. The sheet is the reviewable record, not this message.
   - **Single-product request (Section 1, path A):** `✅ Task 4f2a complete — @Shahrukh please review: [sheet link]`, linking the sheet's specific tab for that SKU.
   - **Bulk request (Section 1, path A):** wait until every product in the trigger message's list is done, then post **one** reply for the whole batch — link the sheet itself (not one tab) since multiple tabs were added, and say how many products/tabs, e.g. `✅ Task 4f2a complete — 12 products drafted, @Shahrukh please review: [sheet link]`. Don't reply per product; there's one thread for the whole batch.
   - **Direct request (Section 1, path B) — no task ID:** don't say "task" or invent an ID. Just the complete marker, account manager, and sheet link: `✅ Complete — @Shahrukh please review: [sheet link]`.
   - **Exception:** if something's genuinely wrong (quota exhausted partway, a page you couldn't reach, a required field you couldn't confidently fill in), say that in one added sentence — a real gap is worth flagging even in a short reply. Don't use this exception to sneak the full draft back in.
   - **Pin that reply to the channel** (the one containing the sheet link) via the Slack pin action, if the first request for this brand's sheet — so the sheet is always reachable from the channel's pinned items without scrolling back through history. Only pin once per brand (the same sheet gets reused across requests, per step 1); skip it on later requests for a brand whose sheet is already pinned.

Do not mark this "done" — the account manager still needs to review and approve before anything reaches the brand. That approval, the client's own approval, any revision notes, and whether it's live are tracked in the sheet's "Approved by AM" / "Approved by Client" / "Feedback" / "Published" columns, not by you.
