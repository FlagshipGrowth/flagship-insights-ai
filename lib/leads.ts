import { getDb } from "./db";

export const LEAD_STAGES = ["new", "contacted", "qualified", "proposal", "won", "lost"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
};

// Placeholder dollar value for a lead with no real estimate given — applied at creation time
// (insertLead below), not just displayed, so it's consistent everywhere the value is used
// (pipeline totals, sorting, exports).
export const DEFAULT_ESTIMATED_VALUE = 2750;

export interface Lead {
  id: string;
  companyName: string;
  contactName: string | null;
  email: string | null;
  source: string | null;
  stage: LeadStage;
  estimatedValue: number | null;
  notes: string | null;
  assignedToId: string | null;
  assignedToEmail: string | null;
  isHot: boolean;
  createdAt: string;
}

export async function getLeads(): Promise<Lead[]> {
  const sql = getDb();
  const rows = await sql`
    select l.id, l.company_name, l.contact_name, l.email, l.source, l.stage,
           l.estimated_value, l.notes, l.assigned_to_id, u.email as assigned_to_email, l.is_hot, l.created_at
    from leads l
    left join users u on u.id = l.assigned_to_id
    order by l.created_at desc
  `;
  return rows.map((r: any) => ({
    id: r.id,
    companyName: r.company_name,
    contactName: r.contact_name,
    email: r.email,
    source: r.source,
    stage: r.stage,
    estimatedValue: r.estimated_value !== null ? Number(r.estimated_value) : null,
    notes: r.notes,
    assignedToId: r.assigned_to_id,
    assignedToEmail: r.assigned_to_email,
    isHot: r.is_hot,
    createdAt: r.created_at,
  }));
}

/** For the "assigned to" picker — only owners work leads on this page, so only owners are
 * offered (matches the internal_admin role, synonymous with "owner" in this app today). */
export async function getOwnerUsers(): Promise<{ id: string; email: string }[]> {
  const sql = getDb();
  const rows = await sql`select id, email from users where role = 'internal_admin' order by email`;
  return rows.map((r: any) => ({ id: r.id, email: r.email }));
}

export interface NewLeadInput {
  companyName: string;
  contactName?: string | null;
  email?: string | null;
  source?: string | null;
  estimatedValue?: number | null;
  notes?: string | null;
  assignedToId?: string | null;
  stage?: LeadStage;
  isHot?: boolean;
}

/** Shared insert used by the "+ Add lead" modal, the CSV bulk-upload route, and the public
 * contact-form endpoint — every lead-creation path funnels through here. */
export async function insertLead(input: NewLeadInput): Promise<void> {
  const sql = getDb();
  await sql`
    insert into leads (company_name, contact_name, email, source, estimated_value, notes, assigned_to_id, stage, is_hot)
    values (${input.companyName}, ${input.contactName ?? null}, ${input.email ?? null},
            ${input.source ?? null}, ${input.estimatedValue ?? DEFAULT_ESTIMATED_VALUE}, ${input.notes ?? null},
            ${input.assignedToId ?? null}, ${input.stage ?? "new"}, ${input.isHot ?? false})
  `;
}

export async function createLead(formData: FormData): Promise<void> {
  const companyName = (formData.get("companyName") as string)?.trim();
  if (!companyName) return;

  const text = (name: string) => (formData.get(name) as string)?.trim() || null;
  const value = (formData.get("estimatedValue") as string)?.trim();
  const assignedToId = (formData.get("assignedToId") as string) || null;

  await insertLead({
    companyName,
    contactName: text("contactName"),
    email: text("email"),
    source: text("source"),
    estimatedValue: value ? Number(value) : null,
    notes: text("notes"),
    assignedToId,
    isHot: formData.get("isHot") === "on",
  });
}

export async function updateLeadStage(leadId: string, stage: string): Promise<void> {
  if (!(LEAD_STAGES as readonly string[]).includes(stage)) return;
  const sql = getDb();
  await sql`update leads set stage = ${stage}, updated_at = now() where id = ${leadId}`;
}

/** For the New-tab triage table's "move selected to..." bulk action — moving many leads out of
 * New at once instead of one at a time. */
export async function bulkUpdateLeadStage(leadIds: string[], stage: string): Promise<void> {
  if (!(LEAD_STAGES as readonly string[]).includes(stage) || leadIds.length === 0) return;
  const sql = getDb();
  await sql`update leads set stage = ${stage}, updated_at = now() where id = any(${leadIds}::uuid[])`;
}

export async function updateLeadValue(leadId: string, estimatedValue: number | null): Promise<void> {
  const sql = getDb();
  await sql`update leads set estimated_value = ${estimatedValue}, updated_at = now() where id = ${leadId}`;
}

export async function deleteLead(leadId: string): Promise<void> {
  const sql = getDb();
  await sql`delete from leads where id = ${leadId}`;
}

export async function setLeadHot(leadId: string, isHot: boolean): Promise<void> {
  const sql = getDb();
  await sql`update leads set is_hot = ${isHot} where id = ${leadId}`;
}

/** Flips in one statement — callers that don't already have the current value in hand (e.g. the
 * New-tab triage table, which calls this directly rather than via a per-row bound action) don't
 * need to look it up first. */
export async function toggleLeadHot(leadId: string): Promise<void> {
  const sql = getDb();
  await sql`update leads set is_hot = not is_hot where id = ${leadId}`;
}
