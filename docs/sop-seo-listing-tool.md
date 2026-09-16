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

## Quick one-off: just @-mention Claude Tag directly

You don't have to run `/seo-listing` at all — you can just tag `@Claude` in any brand's channel and ask directly, e.g. *"@Claude can you draft an SEO listing for [product]?"*. Claude Tag's first reply always asks whether this is **one product or a bulk request for several different products** before doing anything else:
- **One product:** it confirms **Product Name, SKU, ASIN, and the website product page URL** (plus the account manager if it's not obvious) — reply with whatever's missing (SKU/ASIN can be "not assigned/live yet") and it'll research and draft it the same way, into the same `SEO-{BrandName}` sheet.
- **Bulk:** it drops the CSV template right into the thread and points you to `/seo-listing`'s bulk file upload or the dashboard's Bulk SEO listing upload page — it won't try to run a real bulk batch on its own in a Slack thread, since a big batch needs the tracked pipeline (see "Bulk upload" above), not an ad-hoc back-and-forth.

That same first reply also asks whether the product comes in other colors/sizes to cover in the same request — if you list them, Claude Tag researches once and adapts the rest, instead of you needing a separate ask per SKU (see Notes below). It may ask one more quick clarifying question too (e.g. specific claims/certifications to include, or a competitor to benchmark against) if something's genuinely unclear — it's kept to a couple of quick questions, not a full interview.

**The one real difference: this does not create a task on the dashboard.** There's nothing to track in "In Progress"/"Done," and no thread being watched by Flagship AI — it's genuinely untracked, on purpose, for quick one-offs where you don't need the dashboard record. Use `/seo-listing` instead whenever you actually want the request tracked (e.g. anything a client is waiting on, or anything you want visible in the brand's task list).

This only works in a channel Claude Tag has already been invited into — same requirement as everything else here.

## Notes
- A bulk batch is one task and one Slack thread regardless of row count — a single-product request is still its own task/thread, same as always. Every reply (single or bulk) is a short "complete" pointer to the sheet, not the draft itself — this keeps the channel readable even when many requests land close together.
- Color/size variants (new SKU, same product otherwise) run faster — Claude Tag reuses prior research and only updates the varying attribute in search terms/title. If you know upfront a product has multiple variants, mention them all in one request (or answer the @-mention flow's variant question) so Claude Tag researches once and drafts every SKU in that same pass, instead of one request per variant.
- If Claude Tag asks for spend approval before running, reply "approved" in the thread — this is a known open issue we're still tuning.
- Google Sheet lives in the shared Drive under `SEO-{BrandName}`, shared as "Anyone with the link can edit" — anyone on the team can jump in without requesting access.
