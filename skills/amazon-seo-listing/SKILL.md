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

## Procedure

### 1. Familiarize yourself with the product and brand
Read the website product page link. Identify:
- Unique selling propositions (USPs)
- Brand voice and tone
- Where this product sits in its niche/category

### 2. Initial niche analysis
Using Helium10 tools (competitor/niche search, e.g. niche search, competitor lookup by ASIN/keyword), assess:
- Number of competitors and how saturated the category is
- Quality of existing top listings
- Pricing and positioning trends

### 3. Keyword research
- **If the product is already live** (you have an ASIN): pull its current ranking/organic keywords via Helium10's reverse-ASIN keyword lookup (Cerebro-equivalent), and review how it's currently ranking.
- **Competitor and market keyword research**: use Data Dive's keyword/competitor tools. Capture each candidate keyword's search volume, relevancy, and Data Dive's ranking-juice score.
- **Refine to a working keyword list**: keep only keywords that are genuinely usable in the copy — filter out anything low-volume, irrelevant, or that doesn't earn its place. This becomes your working keyword list for steps 4–6.

### 4. Draft the content
Write a base draft using the research above and the brand voice from step 1. If the product already has a live, well-performing listing, use it as a reference rather than starting from nothing.

### 5. Rufus AI FAQ check
- If the product is live: open its Amazon listing and check the Rufus AI FAQ widget on the product detail page for commonly asked questions.
- If not live yet: check the top competitor's listing's Rufus FAQs instead.
- Make sure your bullets/description address the real questions shoppers are asking, where relevant.

### 6. Build the final output

Apply the keyword list from step 3, prioritized by relevancy and ranking-juice, into the three fields below — in this order: Item Name → Item Highlights → Bullet Points → Backend Search Terms. De-duplicate keywords across every field below; nothing needs to be indexed twice, and backend terms exist specifically to catch words *not* already used elsewhere.

#### A. Item Name (Title) — hard limit 75 characters including spaces
Priority order, fitting as much as matters in ~75 chars:
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

#### D. Backend Search Terms — one flat string, byte-limited (not character-limited)
- Confirm the current byte cap in Seller Central before finalizing — this has changed before, don't hardcode an old number
- All lowercase, space-separated, no punctuation (no commas/semicolons/dashes)
- No word repeated; no word that already appears in Title/Highlights/Bullets
- Pick one form per word — singular OR plural, not both
- Strip stopwords: "a," "an," "and," "by," "for," "of," "the," "with"
- Include real synonyms, abbreviations, and genuine alternate spellings a shopper might search — never invent common misspellings
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

**Title specifically:**
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
- Byte length (UTF-8), not character length, checked against the current Seller Central cap
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

Post to the brand's Slack channel (from the channel/brand context, or ask if unknown):

- The Item Name, Item Highlights, all Bullet Points, and the Backend Search Terms string, clearly labeled
- The product name, SKU, and ASIN (if any) this is for
- A one-line note on what changed / why these keywords, if useful context
- **Tag the brand's assigned account manager by name**, and ask them to review before it goes to the client — this is a draft for their approval, not a finished submission. Do not contact the client directly.

Do not mark this "done" — the account manager still needs to review and approve before anything reaches the brand.
