-- Captures what the contact form actually submitted (for a "view submission" link in the CRM UI)
-- and real marketing-attribution signals, instead of only the free-text `source` field an owner
-- types by hand. utm_medium/gclid/fbclid are what the organic-vs-paid badge is derived from;
-- raw_submission is the full posted JSON body, kept verbatim for anything not broken out into its
-- own column. All nullable — only web-form leads will ever populate these; manually-added and
-- bulk-uploaded leads have none of this, which the UI treats as "unknown," not "organic."
alter table leads add column raw_submission jsonb;
alter table leads add column utm_source text;
alter table leads add column utm_medium text;
alter table leads add column utm_campaign text;
alter table leads add column gclid text;
alter table leads add column fbclid text;
alter table leads add column referrer text;
