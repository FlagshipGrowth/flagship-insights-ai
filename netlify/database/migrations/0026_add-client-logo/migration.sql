-- Populated by the enhanced sign-up flow (app/onboarding/page.tsx via lib/clients.ts's
-- provisionClientOrg) using @netlify/blobs — the actual bytes live in the "client-logos" blob
-- store, this just points at the key. Served back through
-- app/api/clients/[clientId]/logo/route.ts. Null for clients that signed up before this existed,
-- or that skipped uploading a logo.
alter table clients add column logo_blob_key text;
