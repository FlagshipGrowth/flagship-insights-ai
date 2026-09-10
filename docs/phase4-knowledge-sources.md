# Phase 4 — knowledge-ingestion source setup

The ingestion pipeline itself (chunking, embedding, retrieval, brand isolation) is built —
see `netlify/functions/lib/knowledge/`. What's NOT built is pulling real content from each
source, because each one needs its own app registration first. Like Amazon (Phase 1), these
are mostly on Joey, not code.

## Slack

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps) under Flagship's workspace.
2. Scopes needed: `channels:history`, `groups:history` (for private client channels), `channels:read`.
3. Install the app to the workspace, get a bot token (`xoxb-...`).
4. Decide which channels are "house" (internal Flagship channels) vs "client" (a specific client's dedicated channel) — this mapping doesn't exist yet and needs a decision, not just code.

## Gmail

1. Create a Google Cloud project, enable the Gmail API.
2. Configure an OAuth consent screen requesting `gmail.readonly`. This is a **sensitive scope** — if the consent screen needs to leave "Testing" mode (i.e., serve more than a fixed list of test users), Google requires a security assessment. That's a real review process, similar in spirit to Amazon's.
3. While in Testing mode, only pre-added test-user Google accounts can authorize — fine for validating the pipeline against Joey's own inbox before deciding whether wider Gmail ingestion is worth the review.

## Fathom

1. Confirm the Fathom plan includes API access (Team plan or above).
2. Generate an API key from Fathom's settings.
3. Decide which calls are "house" (internal strategy calls) vs tagged to a specific client's "client" tier — same open decision as Slack channels.

## Internal docs

No API needed — this is whatever Joey/staff paste or upload directly. Not built yet; would be a simple form + `ingestDocument()` call, same as the other sources once ingested.

## Status

| Source | App registration | Status |
|---|---|---|
| Slack | Slack app creation | Not started |
| Gmail | Google Cloud OAuth client | Not started |
| Fathom | API key | Not started |
| Internal docs | None | Not started (just needs a form) |
