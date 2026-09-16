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
For a brand with a big batch of products (e.g. 50 SKUs for a new catalog launch), don't run `/seo-listing` one product at a time — it's the same command, same modal:
1. **Run `/seo-listing`** as usual.
2. Click **"📥 Download bulk CSV template"** at the top of the modal, fill in one row per product (Product Name, SKU, Website URL, Priority).
3. Attach the completed CSV using the file upload field right below the download button, then hit **Request** — you can leave the single-product fields (Product name, SKU, etc.) blank when uploading a file, they're only required if you're *not* attaching a CSV.
4. The whole batch becomes **one** tracked task and **one** Slack thread (not one per row) — the trigger message lists every product (name, SKU, priority; up to 30 inline, the rest referenced from the task description if the batch is bigger). Claude Tag still researches and drafts each product individually into the sheet (needed for accuracy; there's no shortcut for genuinely different products, though same-product color variants are auto-detected and sped up — see below), then replies once in that one thread when the whole batch is done.
5. That single reply is intentionally just a one-line "complete" marker, not a draft dump — **review the actual content in the `SEO-{BrandName}` Google Sheet**, not in Slack.

Alternative: `/seo-listing bulk` replies with a direct link to the same upload on the dashboard (under a brand's **Tools → Bulk SEO listing upload**), if you'd rather review the batch there before/while it runs.

## Notes
- A bulk batch is one task and one Slack thread regardless of row count — a single-product request is still its own task/thread, same as always. Every reply (single or bulk) is a short "complete" pointer to the sheet, not the draft itself — this keeps the channel readable even when many requests land close together.
- Color-only variants (new SKU, same product otherwise) run faster — Claude Tag reuses prior research and only updates the color in search terms/title.
- If Claude Tag asks for spend approval before running, reply "approved" in the thread — this is a known open issue we're still tuning.
- Google Sheet lives in the shared Drive under `SEO-{BrandName}`, shared as "Anyone with the link can edit" — anyone on the team can jump in without requesting access.
