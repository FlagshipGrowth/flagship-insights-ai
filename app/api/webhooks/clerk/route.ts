import { Webhook } from "svix";
import { headers } from "next/headers";
import { getDb } from "@/lib/db";
import { seedOnboardingTasks } from "@/lib/onboarding-tasks";

// INTERNAL_STAFF_EMAILS / ACCOUNT_MANAGER_EMAILS decide staff role on sign-up — there's no
// Clerk "internal staff" org, so this is the simplest thing that works without asking Joey to
// hand-edit Clerk user metadata for every hire. Revisit if the staff list outgrows an env var.
// Which clients an account_manager actually sees is separate — see account_manager_assignments,
// managed at /internal/assignments.
function parseEmailList(envVar: string | undefined): string[] {
  return (envVar ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
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
      const staffRole = email && ACCOUNT_MANAGER_EMAILS.includes(email)
        ? "account_manager"
        : email && INTERNAL_STAFF_EMAILS.includes(email)
          ? "internal_admin"
          : null;
      if (email && staffRole) {
        await sql`
          insert into users (client_id, role, email, clerk_user_id)
          values (null, ${staffRole}, ${email}, ${event.data.id})
          on conflict (clerk_user_id) do nothing
        `;
      }
      break;
    }

    case "organization.created": {
      // Staff often pre-seed a client's brand(s) (see migration 0009) before that client ever
      // signs up. Link this new org to a pre-seeded, not-yet-linked client with the same name
      // instead of creating a duplicate — only fall back to inserting fresh if there's no match.
      const preseeded = await sql`
        select id from clients where lower(name) = lower(${event.data.name}) and clerk_org_id is null limit 1
      `;
      if (preseeded.length > 0) {
        await sql`update clients set clerk_org_id = ${event.data.id} where id = ${preseeded[0].id}`;
        break;
      }

      await sql`
        insert into clients (name, clerk_org_id)
        values (${event.data.name}, ${event.data.id})
        on conflict (clerk_org_id) do nothing
      `;
      const client = await sql`select id from clients where clerk_org_id = ${event.data.id}`;
      if (client.length > 0) {
        // One default brand per new client org — multi-brand-per-client management is a
        // fast-follow, not built yet (SPEC.md §4's `brands` table supports it already).
        const newBrand = await sql`
          insert into brands (client_id, name, channels_enabled)
          values (${client[0].id}, ${event.data.name}, '{}')
          returning id
        `;
        if (newBrand.length > 0) {
          await seedOnboardingTasks(newBrand[0].id);
        }
      }
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
        await sql`
          insert into users (client_id, role, email, clerk_user_id)
          values (${client[0].id}, ${role}, ${email}, ${clerkUserId})
          on conflict (clerk_user_id)
          do update set role = excluded.role, client_id = excluded.client_id
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
