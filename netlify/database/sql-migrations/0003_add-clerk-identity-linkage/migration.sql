-- Links our clients/users rows to Clerk's identities so the webhook handler
-- (app/api/webhooks/clerk/route.ts) has something to upsert against.
-- clerk_org_id is nullable: internal-test rows (e.g. the BB-Bands seed) have no Clerk org.
alter table clients add column clerk_org_id text unique;
alter table users add column clerk_user_id text unique;
