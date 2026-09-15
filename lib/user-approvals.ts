import { clerkClient } from "@clerk/nextjs/server";
import { getDb } from "./db";
import { seedOnboardingTasks } from "./onboarding-tasks";
import { postSlackMessage } from "./slack";
import { getEmployees, removeEmployeeRow } from "./employees";

export interface PendingUser {
  id: string;
  email: string;
  role: string;
  clientId: string | null;
  clientName: string | null;
  createdAt: string;
  brandCount: number;
}

/** New client sign-ups awaiting admin approval — see migration 0025 and the
 * organizationMembership.created/updated handler in app/api/webhooks/clerk/route.ts, the only
 * path that inserts a 'pending' row. brandCount drives the "needs a brand before approval" gate
 * in approveUser() below and the Approve/Create-brand UI split on /internal/approvals. */
export async function getPendingUsers(): Promise<PendingUser[]> {
  const sql = getDb();
  const rows = await sql`
    select u.id, u.email, u.role, u.client_id, c.name as client_name, u.created_at,
           (select count(distinct b.id) from brands b
            where b.client_id = u.client_id or b.id in (select brand_id from user_brand_access where user_id = u.id)
           ) as brand_count
    from users u
    left join clients c on c.id = u.client_id
    where u.status = 'pending'
    order by u.created_at asc
  `;
  return rows.map((r: any) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    clientId: r.client_id,
    clientName: r.client_name,
    createdAt: r.created_at,
    brandCount: Number(r.brand_count),
  }));
}

export async function getPendingUsersCount(): Promise<number> {
  const sql = getDb();
  const rows = await sql`select count(*) as count from users where status = 'pending'`;
  return Number(rows[0]?.count ?? 0);
}

export interface ClientUser {
  id: string;
  email: string;
  role: string;
  status: "pending" | "approved";
  clientId: string | null;
  clientName: string | null;
  brandCount: number;
}

/** Every client-side user (owner or teammate), for the "Manage users" section on /internal —
 * broader than getPendingUsers, which is just the approval queue. brandCount counts both their
 * own client's brands (brands.client_id) and any explicitly granted via user_brand_access (see
 * lib/brand-access.ts) — either is enough to satisfy "assigned to a brand." */
export async function getClientUsers(): Promise<ClientUser[]> {
  const sql = getDb();
  const rows = await sql`
    select u.id, u.email, u.role, u.status, u.client_id, c.name as client_name,
           (select count(distinct b.id) from brands b
            where b.client_id = u.client_id or b.id in (select brand_id from user_brand_access where user_id = u.id)
           ) as brand_count
    from users u
    left join clients c on c.id = u.client_id
    where u.role in ('client_owner', 'client_teammate')
    order by (u.status = 'pending') desc, c.name, u.email
  `;
  return rows.map((r: any) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    status: r.status,
    clientId: r.client_id,
    clientName: r.client_name,
    brandCount: Number(r.brand_count),
  }));
}

export interface ManagedUser {
  id: string;
  email: string;
  role: string;
  /** Client rows: their real sign-up approval status. Employee rows: always "approved" — an
   * owner-invited employee never queues through the sign-up approval flow. */
  status: "pending" | "approved";
  clientId: string | null;
  /** Client rows: their own client's name. Employee rows: their assigned clients, joined — reuses
   * the same column for a single "who does this relate to" table cell either way. */
  clientName: string | null;
  brandCount: number;
  /** Employee rows only — whether they've actually signed in via Clerk yet. Always true for
   * client rows (they only appear at all via a real sign-up). */
  hasClerkAccount: boolean;
}

/** Client users + employees together, for the unified "Manage users" section on /internal — one
 * user directory instead of a separate employee list. Client-only concepts (brandCount, the
 * approval gate) are blank/inert for employee rows. */
export async function getManagedUsers(): Promise<ManagedUser[]> {
  const [clientUsers, employees] = await Promise.all([getClientUsers(), getEmployees()]);

  const merged: ManagedUser[] = [
    ...clientUsers.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      status: u.status,
      clientId: u.clientId,
      clientName: u.clientName,
      brandCount: u.brandCount,
      hasClerkAccount: true,
    })),
    ...employees.map((e) => ({
      id: e.id,
      email: e.email,
      role: "account_manager",
      status: "approved" as const,
      clientId: null,
      clientName: e.assignedClientNames.length > 0 ? e.assignedClientNames.join(", ") : null,
      brandCount: 0,
      hasClerkAccount: e.hasClerkAccount,
    })),
  ];

  merged.sort((a, b) => {
    if ((a.status === "pending") !== (b.status === "pending")) return a.status === "pending" ? -1 : 1;
    return a.email.localeCompare(b.email);
  });
  return merged;
}

/** Dispatches to the right removal for whichever kind of user this is — the "Manage users" table
 * has one Remove button for both client users and employees. */
export async function removeManagedUser(userId: string, role: string): Promise<void> {
  if (role === "account_manager") {
    await removeEmployeeRow(userId);
  } else {
    await removeClientUser(userId);
  }
}

/** Approving is also the onboarding trigger: seedOnboardingTasks used to fire immediately at
 * organization.created, before any approval — moved here so the checklist only appears once an
 * owner has actually let the client in. Requires the client to already have at least one brand
 * (created via /internal/brands/new — "we create the brand on our end," never automatic at
 * sign-up) — the UI (both /internal/approvals and /internal's "Manage users" section) only shows
 * an Approve button once that's true, but this is checked again here as the real guard. */
export async function approveUser(userId: string): Promise<{ ok: boolean; error?: string }> {
  const sql = getDb();
  const pending = await sql`select client_id, email from users where id = ${userId} and status = 'pending'`;
  if (pending.length === 0) return { ok: false, error: "Not a pending sign-up." };
  const clientId = pending[0].client_id;
  if (!clientId) return { ok: false, error: "No client linked to this account." };

  const brands = await sql`select id from brands where client_id = ${clientId}`;
  if (brands.length === 0) return { ok: false, error: "Assign a brand to this client before approving." };

  await sql`update users set status = 'approved' where id = ${userId}`;

  for (const b of brands) {
    // Guard against double-seeding if this ever re-fires, or a brand was already backfilled.
    const hasTasks = await sql`select 1 from tasks where brand_id = ${b.id} limit 1`;
    if (hasTasks.length === 0) await seedOnboardingTasks(b.id);
  }

  if (process.env.SLACK_ALERTS_CHANNEL_ID) {
    const client = await sql`select name from clients where id = ${clientId}`;
    // Best-effort — a Slack outage should never block the approval itself.
    await postSlackMessage({
      channel: process.env.SLACK_ALERTS_CHANNEL_ID,
      text: `✅ New client approved: ${client[0]?.name ?? "unknown"} (${pending[0].email}) — onboarding checklist seeded.`,
    }).catch((err) => console.error(`approveUser Slack alert failed: ${err}`));
  }

  return { ok: true };
}

/** Removes a client user entirely — their Clerk org membership (if any) and the local row.
 * Caller is responsible for the isOwner() gate (both call sites already check before invoking
 * this), same convention as deleteBrand. */
export async function removeClientUser(userId: string): Promise<void> {
  const sql = getDb();
  const rows = await sql`select clerk_user_id, client_id from users where id = ${userId}`;
  if (rows.length === 0) return;
  const { clerk_user_id: clerkUserId, client_id: clientId } = rows[0];

  if (clerkUserId && clientId) {
    const client = await sql`select clerk_org_id from clients where id = ${clientId}`;
    const clerkOrgId = client[0]?.clerk_org_id;
    if (clerkOrgId) {
      const clerk = await clerkClient();
      try {
        await clerk.organizations.deleteOrganizationMembership({ organizationId: clerkOrgId, userId: clerkUserId });
      } catch {
        // Already gone on Clerk's side (or never had a membership) — still remove the local row.
      }
    }
  }

  await sql`delete from users where id = ${userId}`;
}
