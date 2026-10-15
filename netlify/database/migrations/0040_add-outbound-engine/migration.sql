-- Outbound Sales Engine, phase 1 (CRM + scoring): the prospect-side tables the automated
-- outbound engine writes to. Deliberately separate from `leads` — a prospect is a sourced,
-- scored brand that hasn't engaged yet; it only becomes a `leads` row (linked via lead_id) once
-- it's worth working by hand (an interested reply, or an owner pushing it to the pipeline).
-- Tables for later phases (audits, sequence touches, A/B tests, replies) are created here too so
-- the schema is settled once, but nothing writes to them until those phases are built.

-- Scoring weights are versioned rather than edited in place: the latest row is the active model,
-- older rows are the history of the monthly re-weighting. Every prospect records which version
-- scored it.
create table outbound_scoring_weights (
    id              serial primary key,
    listing_gaps    integer not null check (listing_gaps >= 0),
    channel_gaps    integer not null check (channel_gaps >= 0),
    bsr_trend       integer not null check (bsr_trend >= 0),
    revenue_fit     integer not null check (revenue_fit >= 0),
    trigger_events  integer not null check (trigger_events >= 0),
    note            text,
    created_by      text,
    created_at      timestamptz not null default now(),
    check (listing_gaps + channel_gaps + bsr_trend + revenue_fit + trigger_events = 100)
);
insert into outbound_scoring_weights (listing_gaps, channel_gaps, bsr_trend, revenue_fit, trigger_events, note)
values (30, 20, 20, 15, 15, 'Starting weights from the build plan');

create table outbound_prospects (
    id                   uuid primary key default gen_random_uuid(),
    company_name         text not null,
    -- Dedupe key: lowercase alphanumerics only, so "Smood Sweets", "smood-sweets" and
    -- "SMOOD SWEETS" collide.
    normalized_name      text generated always as (lower(regexp_replace(company_name, '[^a-zA-Z0-9]', '', 'g'))) stored,
    website              text,
    amazon_store_url     text,
    primary_asin         text,
    category             text,
    est_monthly_revenue  numeric,
    -- Raw pre-screen facts the score is computed from (see lib/outbound-scoring.ts's
    -- ProspectFacts) — kept so a re-weighting can rescore without re-fetching anything.
    facts                jsonb not null default '{}',
    score                integer,
    score_breakdown      jsonb,
    tier                 text check (tier in ('A', 'B', 'C')),
    launch_track         boolean not null default false,
    weights_id           integer references outbound_scoring_weights(id),
    status               text not null default 'scored' check (status in (
                           'scored', 'audit_pending', 'audited', 'ready', 'in_sequence',
                           'replied', 'booked', 'closed', 'suppressed', 'disqualified')),
    status_reason        text,
    research_notes       text,
    source               text,
    lead_id              uuid references leads(id) on delete set null,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now()
);
create unique index outbound_prospects_normalized_name_idx on outbound_prospects(normalized_name);
create index outbound_prospects_tier_status_idx on outbound_prospects(tier, status);

create table outbound_contacts (
    id                 uuid primary key default gen_random_uuid(),
    prospect_id        uuid not null references outbound_prospects(id) on delete cascade,
    full_name          text,
    title              text,
    email              text,
    -- Unverified emails are never sent (build plan, "Find the decision-maker").
    email_verified     boolean not null default false,
    linkedin_url       text,
    instagram_handle   text,
    personal_detail    text,
    is_primary         boolean not null default false,
    created_at         timestamptz not null default now()
);
create index outbound_contacts_prospect_idx on outbound_contacts(prospect_id);
-- Global, not per-prospect: the same person must never be sequenced twice under two brands.
create unique index outbound_contacts_email_idx on outbound_contacts(lower(email)) where email is not null;

-- Opt-outs and manual do-not-contact entries, checked at ingest. Opt-outs apply across every
-- channel. `value` is stored normalized (lowercased email / bare domain / normalized name).
create table outbound_suppressions (
    id          uuid primary key default gen_random_uuid(),
    kind        text not null check (kind in ('email', 'domain', 'company')),
    value       text not null,
    -- Which bucket the entry belongs to on the do-not-contact list (lib/outbound.ts's
    -- SUPPRESSION_CATEGORIES). All buckets block outreach the same way.
    category    text not null default 'other' check (category in (
                  'client', 'client_parent', 'past_client', 'warm_lead', 'referral_partner',
                  'crm_lead', 'opt_out', 'other')),
    reason      text,
    created_by  text,
    created_at  timestamptz not null default now(),
    unique (kind, value)
);

-- One audit per run on a prospect. `findings` holds the structured audit (lib/outbound-audit.ts's
-- AuditFindings). The page a prospect sees is /audit/<share_token> and only renders once an owner
-- has approved it; drafts are previewed inside the CRM.
create table outbound_audits (
    id                       uuid primary key default gen_random_uuid(),
    prospect_id              uuid not null references outbound_prospects(id) on delete cascade,
    kind                     text not null check (kind in ('deep', 'light', 'launch')),
    status                   text not null default 'draft' check (status in ('draft', 'approved', 'rejected')),
    share_token              text not null unique default replace(gen_random_uuid()::text, '-', ''),
    headline                 text,
    findings                 jsonb not null default '{}',
    -- The brand's real main image (public Amazon URL) and our AI concept of it, stored in Netlify
    -- Blobs (store "outbound-audit-images") so the link never expires.
    original_image_url       text,
    main_image_blob_key      text,
    main_image_content_type  text,
    helium10_calls           integer,
    reviewed_by              text,
    reviewed_at              timestamptz,
    review_note              text,
    created_at               timestamptz not null default now()
);
create index outbound_audits_prospect_idx on outbound_audits(prospect_id);

create table outbound_ab_tests (
    id                     uuid primary key default gen_random_uuid(),
    variable               text not null check (variable in ('subject', 'opener', 'cta', 'audit_hook')),
    channel                text not null default 'email' check (channel in ('email', 'linkedin', 'instagram')),
    step_day               integer,
    status                 text not null default 'running' check (status in ('running', 'concluded')),
    min_sends_per_variant  integer not null default 200,
    winner_variant_id      uuid,
    notes                  text,
    started_at             timestamptz not null default now(),
    concluded_at           timestamptz
);

create table outbound_ab_variants (
    id          uuid primary key default gen_random_uuid(),
    test_id     uuid not null references outbound_ab_tests(id) on delete cascade,
    label       text not null,
    content     text not null,
    is_control  boolean not null default false,
    created_at  timestamptz not null default now()
);
alter table outbound_ab_tests
    add constraint outbound_ab_tests_winner_fk foreign key (winner_variant_id) references outbound_ab_variants(id) on delete set null;

-- One row per planned or sent message. Email rows are sent by the engine; LinkedIn/Instagram
-- rows are a queue for a person to send by hand (sent_by records who). While approval is on
-- (outbound_settings.require_approval) every new touch starts at needs_review; approving it moves
-- it to queued, which is what the sender and the VA queue pick up.
create table outbound_touches (
    id              uuid primary key default gen_random_uuid(),
    prospect_id     uuid not null references outbound_prospects(id) on delete cascade,
    contact_id      uuid references outbound_contacts(id) on delete set null,
    channel         text not null check (channel in ('email', 'linkedin', 'instagram')),
    step_day        integer not null,
    touch_kind      text not null,
    subject         text,
    body            text,
    variant_id      uuid references outbound_ab_variants(id) on delete set null,
    scheduled_for   date,
    status          text not null default 'queued' check (status in ('needs_review', 'queued', 'sent', 'skipped', 'cancelled')),
    reviewed_by     text,
    sending_inbox   text,
    sent_by         text,
    sent_at         timestamptz,
    -- The sending tool's own id for the message, so replies and bounces can be matched back.
    external_id     text,
    created_at      timestamptz not null default now()
);
create index outbound_touches_queue_idx on outbound_touches(status, scheduled_for);
create index outbound_touches_prospect_idx on outbound_touches(prospect_id);

create table outbound_replies (
    id               uuid primary key default gen_random_uuid(),
    prospect_id      uuid not null references outbound_prospects(id) on delete cascade,
    touch_id         uuid references outbound_touches(id) on delete set null,
    channel          text not null check (channel in ('email', 'linkedin', 'instagram')),
    body             text,
    classification   text check (classification in ('interested', 'not_now', 'wrong_person', 'unsubscribe', 'other')),
    draft_response   text,
    contact_id       uuid references outbound_contacts(id) on delete set null,
    from_address     text,
    summary          text,
    external_id      text unique,
    received_at      timestamptz not null default now(),
    handled_at       timestamptz,
    handled_by       text
);
create index outbound_replies_prospect_idx on outbound_replies(prospect_id);

-- Engine-wide switches, one row. Sending starts OFF and approval starts ON: nothing reaches a
-- prospect until Joey turns sending on and approves the messages (build plan: review a daily sample
-- for the first 1-2 weeks, then automatic).
create table outbound_settings (
    id                    boolean primary key default true check (id),
    sending_enabled       boolean not null default false,
    require_approval      boolean not null default true,
    review_sample_size    integer not null default 15,
    daily_new_brands      integer not null default 10,
    daily_email_cap       integer not null default 60,
    monthly_tool_spend    numeric not null default 0,
    updated_by            text,
    updated_at            timestamptz not null default now()
);
insert into outbound_settings default values;
