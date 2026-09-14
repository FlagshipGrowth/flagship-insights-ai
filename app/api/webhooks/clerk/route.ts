import { Webhook } from "svix";
import { headers } from "next/headers";
import { getDb } from "@/lib/db";
import { provisionClientOrg } from "@/lib/clients";
import { parseEmailList } from "@/lib/env-lists";

// INTERNAL_STAFF_EMAILS / ACCOUNT_MANAGER_EMAILS are a cold-bootstrap fallback for staff who
// have no pre-provisioned `users` row at all (see user.created below) — this is the mechanism
// that let Joey/Vinny get internal_admin access before /internal/employees (owner-invited,
// DB-row-first) existed. Which clients an account_manager actually sees is separate — see
// account_manager_assignments, managed at /internal/assignments.
const INTERNAL_STAFF_EMAILS = parseEmailList(process.env.INTERNAL_STAFF_EMAILS);
const ACCOUNT_MANAGER_EMAILS = parseEmailList(process.env.ACCOUNT_MANAGER_EMAILS);

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    return new Response("CLERK_WEBHOOK_SIGNING_SECRET is not set", { status: 500 });
  }

  const payload = await req.text();
  const headerList = await headers();
  const svixHeaders = {
    "svix-id": headerList.get("svix-id") ?? "",
    "svix-timestamp": headerList.get("svix-timestamp") ?? "",
    "svix-signature": headerList.get("svix-signature") ?? "",
  };

  // svix's verify() only checks the signature and returns undefined (jsonParse: false
  // internally) — it does NOT hand back the parsed payload. Parse it ourselves once
  // verification hasn't thrown.
  try {
    new Webhook(secret).verify(payload, svixHeaders);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  const event = JSON.parse(payload) as { type: string; data: any };

  const sql = getDb();

  switch (event.type) {
    case "user.created": {
      const email = event.data.email_addresses?.[0]?.email_address?.toLowerCase();
      if (!email) break;
      const clerkUserId = event.data.id;

      // A pre-provisioned row already exists — an owner-invited employee
      // (app/internal/employees/page.tsx) or an admin-added client teammate
      // (app/internal/brand/[brandId]/page.tsx's addBrandUser). Link identity only; role,
      // client_id, and status were already decided by whoever created that row, and
      // organizationMembership below independently reconciles a client user's role/client_id
      // when they join/create an org — this branch must not fight with that.
      const existing = await sql`select id from users where email = ${email}`;
      if (existing.length > 0) {
        await sql`update users set clerk_user_id = ${clerkUserId} where id = ${existing[0].id}`;
        break;
      }

      // No pre-existing row — fall back to the env-list cold-bootstrap (see the const comment
      // above). Anyone matching neither this nor a pre-provisioned row gets no row at all here;
      // they only get one via the client sign-up path (organizationMembership, status='pending').
      const staffRole = ACCOUNT_MANAGER_EMAILS.includes(email)
        ? "account_manager"
        : INTERNAL_STAFF_EMAILS.includes(email)
          ? "internal_admin"
          : null;
      if (staffRole) {
        await sql`
          insert into users (client_id, role, email, clerk_user_id, status)
          values (null, ${staffRole}, ${email}, ${clerkUserId}, 'approved')
        `;
      }
      break;
    }

    case "organization.created": {
      // Usually already provisioned by app/onboarding/page.tsx's server action (which creates
      // the org directly via Clerk's Backend SDK so it can attach a logo in the same request) —
      // this webhook still fires afterward, so provisionClientOrg is idempotent on both the
      // client and brand rows and this is a safe no-op in that case. It's the ONLY path taken
      // for an org created outside that flow (e.g. directly from the Clerk dashboard).
      // Onboarding-checklist seeding happens on approval (lib/user-approvals.ts), not here — a
      // brand can exist before its client is approved.
      await provisionClientOrg({ name: event.data.name, clerkOrgId: event.data.id });
      break;
    }

    case "organizationMembership.created":
    case "organizationMembership.updated": {
      const orgId = event.data.organization.id;
      const clerkUserId = event.data.public_user_data.user_id;
      const email = event.data.public_user_data.identifier;
      const role = event.data.role === "org:admin" ? "client_owner" : "client_teammate";

      const client = await sql`select id from clients where clerk_org_id = ${orgId}`;
      if (client.length > 0) {
        // Conflict target is email, not clerk_user_id: the internal admin's "add user" action
        // (app/internal/brand/[brandId]/page.tsx) pre-provisions a users row (real email,
        // clerk_user_id null) before the person ever accepts their Clerk invite. Conflicting on
        // clerk_user_id would miss that row entirely (its clerk_user_id is null, never equal to
        // the new one) and attempt a second INSERT, which would then fail on the separate
        // `users.email` unique constraint. Email is always present and unique, so it's the
        // correct arbiter for linking a pending row to the real Clerk identity once it exists.
        // status is set only on the INSERT branch, not in `do update` — a genuinely new row (no
        // admin pre-provisioned it, no prior sign-up) starts 'pending' until an admin approves it
        // on /internal/approvals, but a row that already exists (pre-provisioned by an admin, or
        // already approved from an earlier membership event) keeps whatever status it already has
        // when its role/client_id/clerk_user_id get updated here.
        await sql`
          insert into users (client_id, role, email, clerk_user_id, status)
          values (${client[0].id}, ${role}, ${email}, ${clerkUserId}, 'pending')
          on conflict (email)
          do update set role = excluded.role, client_id = excluded.client_id, clerk_user_id = excluded.clerk_user_id
        `;
      }
      break;
    }

    case "organizationMembership.deleted":
    case "user.deleted": {
      const clerkUserId = event.data.public_user_data?.user_id ?? event.data.id;
      if (clerkUserId) {
        await sql`delete from users where clerk_user_id = ${clerkUserId}`;
      }
      break;
    }
  }

  return new Response("ok", { status: 200 });
}
