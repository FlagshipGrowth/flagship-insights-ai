import { getDb } from "./db";
import { seedOnboardingTasks } from "./onboarding-tasks";
import { postSlackMessage } from "./slack";

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
           count(b.id) as brand_count
    from users u
    left join clients c on c.id = u.client_id
    left join brands b on b.client_id = u.client_id
    where u.status = 'pending'
    group by u.id, u.email, u.role, u.client_id, c.name, u.created_at
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
 * broader than getPendingUsers, which is just the approval queue. A user's brands are their
 * client's brands (brands.client_id), not assigned per-user, so "assigned to a brand" here just
 * means their client has at least one. */
export async function getClientUsers(): Promise<ClientUser[]> {
  const sql = getDb();
  const rows = await sql`
    select u.id, u.email, u.role, u.status, u.client_id, c.name as client_name,
           count(b.id) as brand_count
    from users u
    left join clients c on c.id = u.client_id
    left join brands b on b.client_id = u.client_id
    where u.role in ('client_owner', 'client_teammate')
    group by u.id, u.email, u.role, u.status, u.client_id, c.name
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
