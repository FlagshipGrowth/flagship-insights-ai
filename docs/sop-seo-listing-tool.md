# SOP: Amazon SEO Listing Tool

## When to use it
Any time a product needs new/optimized Amazon listing copy (title, bullets, description, backend search terms, alt text).

## Steps

1. **Open Slack**, go to the brand's channel.
2. **Run `/seo-listing`**.
3. **Fill in the form:**
   - Product name
   - SKU (leave blank if not assigned yet)
   - Website product page URL (the real product page, not the homepage)
   - Priority (optional)
4. **Submit.** This automatically:
   - Creates a trackable task on the dashboard (category: SEO Listing Request)
   - Posts a message in the same Slack channel tagging Claude Tag with all the details
5. **Wait for Claude Tag's reply in the thread.** It will:
   - Research the brand's site and pull Data Dive keyword/Ranking Juice data
   - Post the draft (Title A/B, Highlights, Bullets, Description, Backend Search Terms, Alt Text) directly in the thread
   - Create/update a Google Sheet named `SEO-{BrandName}`, one tab per SKU, with Current vs. Proposed copy + Ranking Juice scores
6. **Account manager reviews** the draft in the thread and Google Sheet — approve as-is, or reply in the thread with edits/feedback.
7. Once approved, the account manager updates the live Amazon listing.
8. **Track status** on the dashboard — the task flips to "In Progress" automatically once Claude Tag replies; mark it **Done** once the listing is live.

## Bulk upload (many SKUs at once)
For a brand with a big batch of products (e.g. 50 SKUs for a new catalog launch), don't run `/seo-listing` one at a time:
1. Get to the bulk upload page either way:
   - In Slack, run `/seo-listing bulk` — it replies with a direct link.
   - Or on the brand's dashboard page, open **Bulk SEO listing upload** (under Tools).
2. Download the CSV template, fill in one row per product (Product Name, SKU, Website URL, Priority).
3. Re-upload it. Each row becomes its own tracked task and its own Slack thread — Claude Tag researches and drafts each product individually (needed for accuracy; there's no shortcut for genuinely different products, though same-product color variants are auto-detected and sped up — see below).
4. Each task's Slack reply is intentionally just a one-line "complete" marker, not a draft dump — **review the actual content in the `SEO-{BrandName}` Google Sheet**, not in Slack.

## Notes
- Every task's Slack reply (single or bulk) is a short "complete" pointer to the sheet, not the draft itself — this keeps the channel readable even when many requests land close together.
- Color-only variants (new SKU, same product otherwise) run faster — Claude Tag reuses prior research and only updates the color in search terms/title.
- If Claude Tag asks for spend approval before running, reply "approved" in the thread — this is a known open issue we're still tuning.
- Google Sheet lives in the shared Drive under `SEO-{BrandName}`, shared as "Anyone with the link can edit" — anyone on the team can jump in without requesting access.
