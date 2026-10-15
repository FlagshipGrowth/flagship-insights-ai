-- Instantly is the sending tool (Joey, 2026-10-15). It sends through campaigns, not one-off
-- emails, so the engine runs one Instantly campaign whose 5 steps are filled per lead from
-- custom variables (lib/instantly.ts). The campaign and the reply webhook are created once from
-- /internal/crm/outbound ("Connect Instantly") and remembered here.
alter table outbound_settings
    add column instantly_campaign_id text,
    add column instantly_webhook_id  text;

-- When a brand's approved sequence is handed to Instantly: the Instantly lead id and when.
-- Individual touches are then marked sent as Instantly's email_sent webhooks arrive.
alter table outbound_prospects
    add column sender_lead_id text,
    add column handed_off_at  timestamptz,
    -- Apollo email lookups, so a brand isn't re-checked (and re-billed) every day.
    add column email_lookup_at     timestamptz,
    add column email_lookup_result text;

alter table outbound_contacts
    add column email_source text;

-- Replies and sends are also pulled from Instantly's email list every 15 minutes (in case a
-- webhook is missed or webhooks aren't on the plan). This is how far that pull has got.
alter table outbound_settings
    add column instantly_synced_at timestamptz;
