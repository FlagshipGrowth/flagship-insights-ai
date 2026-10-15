import { getDb } from "./db";
import { insertLead } from "./leads";
import {
  parseFacts,
  scoreProspect,
  type ProspectFacts,
  type ScoreResult,
  type ScoringWeights,
  type Tier,
} from "./outbound-scoring";

export const PROSPECT_STATUSES = [
  "scored",
  "audit_pending",
  "audited",
  "ready",
  "in_sequence",
  "replied",
  "booked",
  "closed",
  "suppressed",
  "disqualified",
] as const;
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

export const PROSPECT_STATUS_LABELS: Record<ProspectStatus, string> = {
  scored: "Scored",
  audit_pending: "Audit pending",
  audited: "Audited",
  ready: "Ready to send",
  in_sequence: "In sequence",
  replied: "Replied",
  booked: "Call booked",
  closed: "Closed",
  suppressed: "Suppressed",
  disqualified: "Disqualified",
};

export const SUPPRESSION_KINDS = ["email", "domain", "company"] as const;
export type SuppressionKind = (typeof SUPPRESSION_KINDS)[number];

/** Same rule as outbound_prospects.normalized_name's generated column — keep the two in sync. */
export function normalizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

/** "https://www.Brand.com/shop" → "brand.com". Accepts a bare domain too. */
export function normalizeDomain(urlOrDomain: string): string | null {
  const s = urlOrDomain.trim().toLowerCase();
  if (!s) return null;
  try {
    const host = new URL(s.includes("://") ? s : `https://${s}`).hostname;
    return host.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

function normalizeSuppressionValue(kind: SuppressionKind, value: string): string | null {
  if (kind === "email") return value.trim().toLowerCase() || null;
  if (kind === "domain") return normalizeDomain(value);
  return normalizeName(value) || null;
}

// ---------------------------------------------------------------------------------------------
// Scoring weights

export interface WeightsRow extends ScoringWeights {
  id: number;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
}

function toWeightsRow(r: any): WeightsRow {
  return {
    id: r.id,
    listingGaps: r.listing_gaps,
    channelGaps: r.channel_gaps,
    bsrTrend: r.bsr_trend,
    revenueFit: r.revenue_fit,
    triggerEvents: r.trigger_events,
    note: r.note,
    createdBy: r.created_by,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

export async function getWeightsHistory(limit = 6): Promise<WeightsRow[]> {
  const sql = getDb();
  const rows = await sql`select * from outbound_scoring_weights order by id desc limit ${limit}`;
  return rows.map(toWeightsRow);
}

export async function getActiveWeights(): Promise<WeightsRow> {
  const [latest] = await getWeightsHistory(1);
  return latest;
}

/** Saves a new weights version and rescores every prospect with it, so tiers always reflect the
 * active model. Returns an error message instead of saving if the weights don't sum to 100. */
export async function saveWeightsAndRescore(weights: ScoringWeights, note: string | null, createdBy: string): Promise<string | null> {
  const values = Object.values(weights);
  if (values.some((v) => !Number.isInteger(v) || v < 0)) return "Weights must be whole numbers, 0 or more.";
  const sum = values.reduce((a, b) => a + b, 0);
  if (sum !== 100) return `Weights must add up to 100 (they add up to ${sum}).`;

  const sql = getDb();
  const [row] = await sql`
    insert into outbound_scoring_weights (listing_gaps, channel_gaps, bsr_trend, revenue_fit, trigger_events, note, created_by)
    values (${weights.listingGaps}, ${weights.channelGaps}, ${weights.bsrTrend}, ${weights.revenueFit}, ${weights.triggerEvents}, ${note}, ${createdBy})
    returning *
  `;
  const active = toWeightsRow(row);

  const prospects = await sql`select id, facts, est_monthly_revenue from outbound_prospects`;
  const updates = prospects.map((p: any) => {
    const result = scoreProspect(p.facts ?? {}, p.est_monthly_revenue !== null ? Number(p.est_monthly_revenue) : null, active);
    return { id: p.id, score: result.score, tier: result.tier, launch_track: result.launchTrack, breakdown: result.signals };
  });
  if (updates.length > 0) {
    // One statement for the whole table rather than a round trip per prospect.
    await sql`
      update outbound_prospects p
      set score = u.score, tier = u.tier, launch_track = u.launch_track, score_breakdown = u.breakdown,
          weights_id = ${active.id}, updated_at = now()
      from jsonb_to_recordset(${JSON.stringify(updates)}::jsonb)
        as u(id uuid, score integer, tier text, launch_track boolean, breakdown jsonb)
      where p.id = u.id
    `;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Ingest (called by the sourcing agent via /api/outbound/ingest)

export interface ContactInput {
  fullName: string | null;
  title: string | null;
  email: string | null;
  emailVerified: boolean;
  linkedinUrl: string | null;
  instagramHandle: string | null;
  personalDetail: string | null;
  isPrimary: boolean;
}

export interface ProspectInput {
  companyName: string;
  website: string | null;
  amazonStoreUrl: string | null;
  primaryAsin: string | null;
  category: string | null;
  estMonthlyRevenue: number | null;
  facts: ProspectFacts;
  researchNotes: string | null;
  contacts: ContactInput[];
}

/** Validates one untrusted prospect object from the ingest API. Returns an error string if it
 * can't be used at all. */
export function parseProspectInput(input: unknown): ProspectInput | string {
  if (!input || typeof input !== "object") return "Not an object";
  const o = input as Record<string, any>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const companyName = str(o.companyName);
  if (!companyName || !normalizeName(companyName)) return "Missing companyName";
  const revenue = typeof o.estMonthlyRevenue === "number" && Number.isFinite(o.estMonthlyRevenue) ? o.estMonthlyRevenue : null;
  const contacts: ContactInput[] = Array.isArray(o.contacts)
    ? o.contacts
        .filter((c: unknown) => c && typeof c === "object")
        .map((c: Record<string, any>, i: number) => ({
          fullName: str(c.fullName),
          title: str(c.title),
          email: str(c.email)?.toLowerCase() ?? null,
          emailVerified: c.emailVerified === true,
          linkedinUrl: str(c.linkedinUrl),
          instagramHandle: str(c.instagramHandle),
          personalDetail: str(c.personalDetail),
          isPrimary: c.isPrimary === true || (i === 0 && !o.contacts.some((x: any) => x?.isPrimary === true)),
        }))
    : [];
  return {
    companyName,
    website: str(o.website),
    amazonStoreUrl: str(o.amazonStoreUrl),
    primaryAsin: str(o.primaryAsin),
    category: str(o.category),
    estMonthlyRevenue: revenue,
    facts: parseFacts(o.facts),
    researchNotes: str(o.researchNotes),
    contacts,
  };
}

export interface IngestResult {
  inserted: { id: string; companyName: string; score: number; tier: Tier; status: ProspectStatus }[];
  skipped: { companyName: string; reason: string }[];
  droppedContacts: { companyName: string; email: string; reason: string }[];
}

/** Dedupes and suppresses against current clients, existing leads, existing prospects and the
 * suppression list, then scores and inserts what's left. Everything that's skipped comes back
 * with a reason so the agent's run log shows why. */
export async function ingestProspects(inputs: ProspectInput[], source: string): Promise<IngestResult> {
  const sql = getDb();
  const [clientNames, leadRows, prospectNames, contactEmails, suppressions, weights] = await Promise.all([
    sql`select name from clients union select name from brands`,
    sql`select company_name, email from leads`,
    sql`select normalized_name from outbound_prospects`,
    sql`select lower(email) as email from outbound_contacts where email is not null`,
    sql`select kind, value from outbound_suppressions`,
    getActiveWeights(),
  ]);

  const clientSet = new Set(clientNames.map((r: any) => normalizeName(r.name)));
  const leadNameSet = new Set(leadRows.map((r: any) => normalizeName(r.company_name)));
  const leadEmailSet = new Set(leadRows.filter((r: any) => r.email).map((r: any) => r.email.toLowerCase()));
  const prospectSet = new Set(prospectNames.map((r: any) => r.normalized_name));
  const contactEmailSet = new Set(contactEmails.map((r: any) => r.email));
  const suppressed = { email: new Set<string>(), domain: new Set<string>(), company: new Set<string>() };
  for (const s of suppressions as any[]) suppressed[s.kind as SuppressionKind].add(s.value);

  const result: IngestResult = { inserted: [], skipped: [], droppedContacts: [] };

  for (const p of inputs) {
    const key = normalizeName(p.companyName);
    const domain = p.website ? normalizeDomain(p.website) : null;
    const skipReason = clientSet.has(key)
      ? "Current client"
      : suppressed.company.has(key)
        ? "Suppressed (company)"
        : domain && suppressed.domain.has(domain)
          ? "Suppressed (domain)"
          : leadNameSet.has(key)
            ? "Already in the CRM pipeline"
            : prospectSet.has(key)
              ? "Already a prospect"
              : null;
    if (skipReason) {
      result.skipped.push({ companyName: p.companyName, reason: skipReason });
      continue;
    }

    const contacts = p.contacts.filter((c) => {
      if (!c.email) return true;
      const emailDomain = c.email.split("@")[1] ?? "";
      const reason = suppressed.email.has(c.email) || suppressed.domain.has(emailDomain)
        ? "Suppressed"
        : contactEmailSet.has(c.email) || leadEmailSet.has(c.email)
          ? "Already contacted"
          : null;
      if (reason) result.droppedContacts.push({ companyName: p.companyName, email: c.email, reason });
      return !reason;
    });

    const scored: ScoreResult = scoreProspect(p.facts, p.estMonthlyRevenue, weights);
    const status: ProspectStatus = scored.eligible ? "scored" : "disqualified";

    const contactRows = contacts.map((c) => ({
      full_name: c.fullName,
      title: c.title,
      email: c.email,
      email_verified: c.emailVerified,
      linkedin_url: c.linkedinUrl,
      instagram_handle: c.instagramHandle,
      personal_detail: c.personalDetail,
      is_primary: c.isPrimary,
    }));

    // Prospect + its contacts in one statement. `on conflict do nothing` covers a race with
    // another ingest run (the pre-check above handles the normal case).
    const rows = await sql`
      with p as (
        insert into outbound_prospects (
          company_name, website, amazon_store_url, primary_asin, category, est_monthly_revenue, facts,
          score, score_breakdown, tier, launch_track, weights_id, status, status_reason, research_notes, source
        ) values (
          ${p.companyName}, ${p.website}, ${p.amazonStoreUrl}, ${p.primaryAsin}, ${p.category}, ${p.estMonthlyRevenue},
          ${JSON.stringify(p.facts)}::jsonb, ${scored.score}, ${JSON.stringify(scored.signals)}::jsonb, ${scored.tier},
          ${scored.launchTrack}, ${weights.id}, ${status}, ${scored.ineligibleReason}, ${p.researchNotes}, ${source}
        )
        on conflict do nothing
        returning id
      ), c as (
        insert into outbound_contacts (prospect_id, full_name, title, email, email_verified, linkedin_url, instagram_handle, personal_detail, is_primary)
        select p.id, c.full_name, c.title, c.email, c.email_verified, c.linkedin_url, c.instagram_handle, c.personal_detail, c.is_primary
        from p, jsonb_to_recordset(${JSON.stringify(contactRows)}::jsonb)
          as c(full_name text, title text, email text, email_verified boolean, linkedin_url text,
               instagram_handle text, personal_detail text, is_primary boolean)
        on conflict do nothing
      )
      select id from p
    `;
    if (rows.length === 0) {
      result.skipped.push({ companyName: p.companyName, reason: "Already a prospect" });
      continue;
    }
    prospectSet.add(key);
    for (const c of contacts) if (c.email) contactEmailSet.add(c.email);
    result.inserted.push({ id: rows[0].id, companyName: p.companyName, score: scored.score, tier: scored.tier, status });
  }
  return result;
}

// ---------------------------------------------------------------------------------------------
// Reads for the CRM's Outbound tab

export interface ProspectRow {
  id: string;
  companyName: string;
  website: string | null;
  category: string | null;
  estMonthlyRevenue: number | null;
  score: number | null;
  tier: Tier | null;
  launchTrack: boolean;
  status: ProspectStatus;
  statusReason: string | null;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactVerified: boolean;
  createdAt: string;
}

export async function getProspects(filter: { tier: Tier | null; status: ProspectStatus | null }): Promise<ProspectRow[]> {
  const sql = getDb();
  const rows = await sql`
    select p.id, p.company_name, p.website, p.category, p.est_monthly_revenue, p.score, p.tier, p.launch_track,
           p.status, p.status_reason, p.created_at,
           c.full_name as contact_name, c.email as contact_email, coalesce(c.email_verified, false) as contact_verified
    from outbound_prospects p
    left join lateral (
      select full_name, email, email_verified from outbound_contacts
      where prospect_id = p.id order by is_primary desc, created_at limit 1
    ) c on true
    where (p.tier = ${filter.tier} or ${filter.tier}::text is null)
      and (p.status = ${filter.status} or ${filter.status}::text is null)
    order by p.score desc nulls last, p.created_at desc
    limit 500
  `;
  return rows.map((r: any) => ({
    id: r.id,
    companyName: r.company_name,
    website: r.website,
    category: r.category,
    estMonthlyRevenue: r.est_monthly_revenue !== null ? Number(r.est_monthly_revenue) : null,
    score: r.score,
    tier: r.tier,
    launchTrack: r.launch_track,
    status: r.status,
    statusReason: r.status_reason,
    primaryContactName: r.contact_name,
    primaryContactEmail: r.contact_email,
    primaryContactVerified: r.contact_verified,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export interface OutboundSummary {
  total: number;
  byTier: Record<Tier, number>;
  launchTrack: number;
  addedToday: number;
  suppressedOrDisqualified: number;
  suppressionCount: number;
}

export async function getOutboundSummary(): Promise<OutboundSummary> {
  const sql = getDb();
  const [[counts], [supp]] = await Promise.all([
    sql`
      select count(*)::int as total,
             count(*) filter (where tier = 'A' and status not in ('suppressed', 'disqualified'))::int as a,
             count(*) filter (where tier = 'B' and status not in ('suppressed', 'disqualified'))::int as b,
             count(*) filter (where tier = 'C' and status not in ('suppressed', 'disqualified'))::int as c,
             count(*) filter (where launch_track and status not in ('suppressed', 'disqualified'))::int as launch,
             count(*) filter (where created_at >= date_trunc('day', now()))::int as today,
             count(*) filter (where status in ('suppressed', 'disqualified'))::int as out
      from outbound_prospects
    `,
    sql`select count(*)::int as n from outbound_suppressions`,
  ]);
  return {
    total: counts.total,
    byTier: { A: counts.a, B: counts.b, C: counts.c },
    launchTrack: counts.launch,
    addedToday: counts.today,
    suppressedOrDisqualified: counts.out,
    suppressionCount: supp.n,
  };
}

export interface ProspectDetail extends ProspectRow {
  amazonStoreUrl: string | null;
  primaryAsin: string | null;
  facts: ProspectFacts;
  scoreBreakdown: ScoreResult["signals"] | null;
  weightsId: number | null;
  researchNotes: string | null;
  source: string | null;
  leadId: string | null;
  contacts: {
    id: string;
    fullName: string | null;
    title: string | null;
    email: string | null;
    emailVerified: boolean;
    linkedinUrl: string | null;
    instagramHandle: string | null;
    personalDetail: string | null;
    isPrimary: boolean;
  }[];
  audits: { id: string; kind: string; status: string; assetUrl: string | null; helium10Calls: number | null; createdAt: string }[];
}

export async function getProspectDetail(id: string): Promise<ProspectDetail | null> {
  const sql = getDb();
  const [[p], contacts, audits] = await Promise.all([
    sql`select * from outbound_prospects where id = ${id}`,
    sql`select * from outbound_contacts where prospect_id = ${id} order by is_primary desc, created_at`,
    sql`select id, kind, status, asset_url, helium10_calls, created_at from outbound_audits where prospect_id = ${id} order by created_at desc`,
  ]);
  if (!p) return null;
  const primary = contacts[0];
  return {
    id: p.id,
    companyName: p.company_name,
    website: p.website,
    category: p.category,
    estMonthlyRevenue: p.est_monthly_revenue !== null ? Number(p.est_monthly_revenue) : null,
    score: p.score,
    tier: p.tier,
    launchTrack: p.launch_track,
    status: p.status,
    statusReason: p.status_reason,
    primaryContactName: primary?.full_name ?? null,
    primaryContactEmail: primary?.email ?? null,
    primaryContactVerified: primary?.email_verified ?? false,
    createdAt: new Date(p.created_at).toISOString(),
    amazonStoreUrl: p.amazon_store_url,
    primaryAsin: p.primary_asin,
    facts: p.facts ?? {},
    scoreBreakdown: p.score_breakdown,
    weightsId: p.weights_id,
    researchNotes: p.research_notes,
    source: p.source,
    leadId: p.lead_id,
    contacts: contacts.map((c: any) => ({
      id: c.id,
      fullName: c.full_name,
      title: c.title,
      email: c.email,
      emailVerified: c.email_verified,
      linkedinUrl: c.linkedin_url,
      instagramHandle: c.instagram_handle,
      personalDetail: c.personal_detail,
      isPrimary: c.is_primary,
    })),
    audits: audits.map((a: any) => ({
      id: a.id,
      kind: a.kind,
      status: a.status,
      assetUrl: a.asset_url,
      helium10Calls: a.helium10_calls,
      createdAt: new Date(a.created_at).toISOString(),
    })),
  };
}

// ---------------------------------------------------------------------------------------------
// Writes from the CRM UI

export async function updateProspectStatus(id: string, status: string): Promise<void> {
  if (!(PROSPECT_STATUSES as readonly string[]).includes(status)) return;
  const sql = getDb();
  await sql`update outbound_prospects set status = ${status}, updated_at = now() where id = ${id}`;
}

/** Adds a suppression entry and marks any existing prospect it matches as suppressed. */
export async function addSuppression(kind: string, rawValue: string, reason: string | null, createdBy: string): Promise<void> {
  if (!(SUPPRESSION_KINDS as readonly string[]).includes(kind)) return;
  const value = normalizeSuppressionValue(kind as SuppressionKind, rawValue);
  if (!value) return;
  const sql = getDb();
  await sql`
    insert into outbound_suppressions (kind, value, reason, created_by)
    values (${kind}, ${value}, ${reason}, ${createdBy})
    on conflict (kind, value) do nothing
  `;
  const statusReason = `Suppressed: ${reason ?? kind}`;
  if (kind === "company") {
    await sql`update outbound_prospects set status = 'suppressed', status_reason = ${statusReason}, updated_at = now() where normalized_name = ${value}`;
  } else if (kind === "email") {
    await sql`
      update outbound_prospects set status = 'suppressed', status_reason = ${statusReason}, updated_at = now()
      where id in (select prospect_id from outbound_contacts where lower(email) = ${value})
    `;
  } else {
    await sql`
      update outbound_prospects set status = 'suppressed', status_reason = ${statusReason}, updated_at = now()
      where id in (select prospect_id from outbound_contacts where split_part(lower(email), '@', 2) = ${value})
         or regexp_replace(lower(coalesce(website, '')), '^(https?://)?(www\\.)?([^/]+).*$', '\\3') = ${value}
    `;
  }
}

export async function suppressProspect(id: string, reason: string | null, createdBy: string): Promise<void> {
  const sql = getDb();
  const [p] = await sql`select company_name from outbound_prospects where id = ${id}`;
  if (!p) return;
  await addSuppression("company", p.company_name, reason ?? "Manually suppressed", createdBy);
}

export async function getRecentSuppressions(limit = 20) {
  const sql = getDb();
  const rows = await sql`select kind, value, reason, created_by, created_at from outbound_suppressions order by created_at desc limit ${limit}`;
  return rows.map((r: any) => ({
    kind: r.kind as SuppressionKind,
    value: r.value as string,
    reason: r.reason as string | null,
    createdBy: r.created_by as string | null,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

/** Creates a CRM lead from a prospect (for when an owner wants to work it by hand) and links the
 * two. No-op if it's already linked. */
export async function pushProspectToPipeline(id: string, assignedToId: string | null): Promise<void> {
  const detail = await getProspectDetail(id);
  if (!detail || detail.leadId) return;
  const primary = detail.contacts[0];
  const notes = [
    `Outbound engine: score ${detail.score ?? "–"} (Tier ${detail.tier ?? "–"})${detail.launchTrack ? ", launch track" : ""}.`,
    detail.researchNotes,
  ]
    .filter(Boolean)
    .join("\n\n");
  const leadId = await insertLead({
    companyName: detail.companyName,
    contactName: primary?.fullName ?? null,
    email: primary?.email ?? null,
    source: "Outbound engine",
    notes,
    assignedToId,
    stage: "contacted",
  });
  const sql = getDb();
  await sql`update outbound_prospects set lead_id = ${leadId}, updated_at = now() where id = ${id}`;
}
