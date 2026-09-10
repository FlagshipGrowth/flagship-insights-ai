import { Webhook } from "svix";
import { headers } from "next/headers";
import { getDb } from "@/lib/db";

// INTERNAL_STAFF_EMAILS decides who becomes internal_admin on sign-up — there's no Clerk
// "internal staff" org, so this is the simplest thing that works without asking Joey to hand-
// edit Clerk user metadata for every hire. Revisit if the staff list outgrows an env var.
const INTERNAL_STAFF_EMAILS = (process.env.INTERNAL_STAFF_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

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

  let event: { type: string; data: any };
  try {
    event = new Webhook(secret).verify(payload, svixHeaders) as unknown as { type: string; data: any };
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const sql = getDb();

  switch (event.type) {
    case "user.created": {
      const email = event.data.email_addresses?.[0]?.email_address?.toLowerCase();
      if (email && INTERNAL_STAFF_EMAILS.includes(email)) {
        await sql`
          insert into users (client_id, role, email, clerk_user_id)
          values (null, 'internal_admin', ${email}, ${event.data.id})
          on conflict (clerk_user_id) do nothing
        `;
      }
      break;
    }

    case "organization.created": {
      await sql`
        insert into clients (name, clerk_org_id)
        values (${event.data.name}, ${event.data.id})
        on conflict (clerk_org_id) do nothing
      `;
      const client = await sql`select id from clients where clerk_org_id = ${event.data.id}`;
      if (client.length > 0) {
        // One default brand per new client org — multi-brand-per-client management is a
        // fast-follow, not built yet (SPEC.md §4's `brands` table supports it already).
        await sql`
          insert into brands (client_id, name, channels_enabled)
          values (${client[0].id}, ${event.data.name}, '{}')
        `;
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
