import { getDb } from "./db";
import { seedOnboardingTasks } from "./onboarding-tasks";
import { postSlackMessage } from "./slack";

export interface PendingUser {
  id: string;
  email: string;
  role: string;
  clientName: string | null;
  createdAt: string;
}

/** New client sign-ups awaiting admin approval — see migration 0025 and the
 * organizationMembership.created/updated handler in app/api/webhooks/clerk/route.ts, the only
 * path that inserts a 'pending' row. */
export async function getPendingUsers(): Promise<PendingUser[]> {
  const sql = getDb();
  const rows = await sql`
    select u.id, u.email, u.role, c.name as client_name, u.created_at
    from users u
    left join clients c on c.id = u.client_id
    where u.status = 'pending'
    order by u.created_at asc
  `;
  return rows.map((r: any) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    clientName: r.client_name,
    createdAt: r.created_at,
  }));
}

export async function getPendingUsersCount(): Promise<number> {
  const sql = getDb();
  const rows = await sql`select count(*) as count from users where status = 'pending'`;
  return Number(rows[0]?.count ?? 0);
}

/** Approving is also the onboarding trigger: seedOnboardingTasks used to fire immediately at
 * organization.created, before any approval — moved here so the checklist only appears once an
 * owner has actually let the client in. */
export async function approveUser(userId: string): Promise<void> {
  const sql = getDb();
  const rows = await sql`
    update users set status = 'approved' where id = ${userId} and status = 'pending'
    returning client_id, email
  `;
  if (rows.length === 0) return; // wasn't pending (already approved, or bad id) — nothing to do
  const clientId = rows[0].client_id;
  if (!clientId) return; // shouldn't happen for a client sign-up, but nothing to seed either way

  const brands = await sql`select id from brands where client_id = ${clientId}`;
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
      text: `✅ New client approved: ${client[0]?.name ?? "unknown"} (${rows[0].email}) — onboarding checklist seeded.`,
    }).catch((err) => console.error(`approveUser Slack alert failed: ${err}`));
  }
}
