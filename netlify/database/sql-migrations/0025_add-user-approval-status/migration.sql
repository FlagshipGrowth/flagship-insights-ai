-- New client sign-ups now need admin approval before they can use the dashboard. Internal
-- staff/account managers don't go through this — they're already vetted via the
-- INTERNAL_STAFF_EMAILS/ACCOUNT_MANAGER_EMAILS allowlist in the Clerk webhook (user.created),
-- and a client row an admin pre-provisions directly (app/internal/brand/[brandId]/page.tsx) is
-- implicitly vetted too. The only path that inserts 'pending' explicitly is
-- organizationMembership.created/updated in app/api/webhooks/clerk/route.ts — a genuinely new
-- client self-signing-up with no prior row. Default here is 'approved' so every other insert
-- path (and every pre-existing row, backfilled below) isn't accidentally locked out.
alter table users add column status text not null default 'approved' check (status in ('pending', 'approved'));
