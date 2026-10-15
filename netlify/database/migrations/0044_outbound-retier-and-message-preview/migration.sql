-- Tier cutoffs lowered from A 80+ / B 55-79 to A 70+ / B 50-69 (lib/outbound-scoring.ts
-- tierForScore). Re-tier existing prospects from their stored score; new ones get the new cutoffs
-- at ingest and on every rescore.
update outbound_prospects
set tier = case when score >= 70 then 'A' when score >= 50 then 'B' else 'C' end,
    updated_at = now()
where score is not null;

-- "Preview emails" on a prospect page: the copy writer drafts the sequence without enrolling
-- (written by netlify/functions/outbound-preview-background.ts), so Joey can read the messages
-- before approving an audit. Overwritten on every preview; never sent.
alter table outbound_prospects
    add column preview_messages jsonb,
    add column preview_status   text check (preview_status in ('pending', 'ready', 'error')),
    add column preview_error    text,
    add column preview_at       timestamptz;
