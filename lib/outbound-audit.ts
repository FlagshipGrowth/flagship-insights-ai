import { getStore } from "@netlify/blobs";
import { getDb } from "./db";
import type { ProspectFacts, Tier } from "./outbound-scoring";

// Outbound Sales Engine, phase 2: the per-brand audit. The outbound-audit agent
// (automations/outbound-audit/SKILL.md) pulls Tier A/B prospects from the queue, runs the Helium10
// deep audit, and posts the structured findings here. An owner reviews each draft in the CRM; only
// approved audits render at their public /audit/<token> link.

/** Helium10's marginal MCP cost: top-ups are $50 per 500 calls. The 1,000 included calls a month
 * are shared, so this is the honest per-call price once the pilot scales past them. */
export const HELIUM10_COST_PER_CALL = 50 / 500;

const IMAGE_STORE = "outbound-audit-images";
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export interface AuditFix {
  title: string;
  detail: string;
}

export interface KeywordGap {
  keyword: string;
  monthlySearchVolume: number | null;
  competitorsRanking: string; // e.g. "Brand X #3, Brand Y #7"
  brandRank: number | null; // null = not ranking in the top pages
}

export interface CompetitorRow {
  name: string;
  asin: string | null;
  price: number | null;
  rating: number | null;
  reviewCount: number | null;
  bsr: number | null;
  imageNote: string | null;
  isBrand: boolean;
}

export interface LaunchOpportunity {
  channel: "walmart" | "tiktok_shop" | "both";
  estimate: string;
  plan: string;
}

export interface AuditFindings {
  summary: string;
  keywordGaps: KeywordGap[];
  competitorBenchmark: CompetitorRow[];
  imageStackFixes: AuditFix[];
  aPlusFixes: AuditFix[];
  adsGaps: AuditFix[];
  launchOpportunity: LaunchOpportunity | null;
  mainImageNotes: string | null;
}

export const AUDIT_KINDS = ["deep", "light", "launch"] as const;
export type AuditKind = (typeof AUDIT_KINDS)[number];
export type AuditStatus = "draft" | "approved" | "rejected";

// ---------------------------------------------------------------------------------------------
// Validation of untrusted agent input

const str = (v: unknown, max = 2000) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const list = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object").slice(0, max) : []);

function parseFixes(v: unknown): AuditFix[] {
  return list(v, 5)
    .map((f: any) => ({ title: str(f.title, 200), detail: str(f.detail, 1000) }))
    .filter((f): f is AuditFix => !!f.title && !!f.detail);
}

export function parseFindings(input: unknown): AuditFindings | string {
  if (!input || typeof input !== "object") return "findings must be an object";
  const o = input as Record<string, unknown>;
  const summary = str(o.summary, 1500);
  if (!summary) return "findings.summary is required";

  const keywordGaps = list(o.keywordGaps, 15)
    .map((k: any) => ({
      keyword: str(k.keyword, 120),
      monthlySearchVolume: num(k.monthlySearchVolume),
      competitorsRanking: str(k.competitorsRanking, 300) ?? "",
      brandRank: num(k.brandRank),
    }))
    .filter((k): k is KeywordGap => !!k.keyword);

  const competitorBenchmark = list(o.competitorBenchmark, 5)
    .map((c: any) => ({
      name: str(c.name, 120),
      asin: str(c.asin, 20),
      price: num(c.price),
      rating: num(c.rating),
      reviewCount: num(c.reviewCount),
      bsr: num(c.bsr),
      imageNote: str(c.imageNote, 300),
      isBrand: c.isBrand === true,
    }))
    .filter((c): c is CompetitorRow => !!c.name);

  let launchOpportunity: LaunchOpportunity | null = null;
  const lo = o.launchOpportunity as any;
  if (lo && typeof lo === "object" && ["walmart", "tiktok_shop", "both"].includes(lo.channel)) {
    const estimate = str(lo.estimate, 500);
    const plan = str(lo.plan, 1500);
    if (estimate && plan) launchOpportunity = { channel: lo.channel, estimate, plan };
  }

  return {
    summary,
    keywordGaps,
    competitorBenchmark,
    imageStackFixes: parseFixes(o.imageStackFixes),
    aPlusFixes: parseFixes(o.aPlusFixes),
    adsGaps: parseFixes(o.adsGaps),
    launchOpportunity,
    mainImageNotes: str(o.mainImageNotes, 800),
  };
}

// ---------------------------------------------------------------------------------------------
// Queue (read by the audit agent)

export interface AuditQueueItem {
  prospectId: string;
  companyName: string;
  tier: Tier;
  score: number;
  launchTrack: boolean;
  website: string | null;
  amazonStoreUrl: string | null;
  primaryAsin: string | null;
  category: string | null;
  estMonthlyRevenue: number | null;
  facts: ProspectFacts;
  researchNotes: string | null;
}

/** Highest-scoring Tier A/B prospects that haven't been audited yet. Claiming them flips their
 * status to audit_pending, so two overlapping agent runs never audit the same brand. A claim that
 * never got an audit posted is released after a day. */
export async function claimAuditQueue(limit: number): Promise<AuditQueueItem[]> {
  const sql = getDb();
  const rows = await sql`
    update outbound_prospects set status = 'audit_pending', updated_at = now()
    where id in (
      select id from outbound_prospects
      where tier in ('A', 'B')
        -- A claim older than a day means that agent run died mid-way: hand it out again.
        and (status = 'scored' or (status = 'audit_pending' and updated_at < now() - interval '1 day'))
      order by score desc, created_at
      limit ${limit}
      for update skip locked
    )
    returning id, company_name, tier, score, launch_track, website, amazon_store_url, primary_asin, category,
              est_monthly_revenue, facts, research_notes
  `;
  return rows
    .map((r: any) => ({
      prospectId: r.id,
      companyName: r.company_name,
      tier: r.tier,
      score: r.score,
      launchTrack: r.launch_track,
      website: r.website,
      amazonStoreUrl: r.amazon_store_url,
      primaryAsin: r.primary_asin,
      category: r.category,
      estMonthlyRevenue: r.est_monthly_revenue !== null ? Number(r.est_monthly_revenue) : null,
      facts: r.facts ?? {},
      researchNotes: r.research_notes,
    }))
    .sort((a: AuditQueueItem, b: AuditQueueItem) => b.score - a.score);
}

// ---------------------------------------------------------------------------------------------
// Writes from the audit agent

export interface NewAuditInput {
  prospectId: string;
  kind: AuditKind;
  headline: string;
  findings: AuditFindings;
  helium10Calls: number | null;
  originalImageUrl: string | null;
  mainImageBase64: string | null;
  mainImageContentType: string | null;
}

/** Stores the audit as a draft and moves the prospect to "audited". Returns an error string if the
 * prospect doesn't exist or the image is unusable. */
export async function createAudit(input: NewAuditInput): Promise<{ auditId: string; shareToken: string } | string> {
  const sql = getDb();
  const [prospect] = await sql`select id from outbound_prospects where id = ${input.prospectId}`;
  if (!prospect) return "Unknown prospectId";

  let image: Buffer | null = null;
  if (input.mainImageBase64) {
    image = Buffer.from(input.mainImageBase64, "base64");
    if (image.length === 0) return "mainImageBase64 is empty or not base64";
    if (image.length > MAX_IMAGE_BYTES) return `Main image concept is over ${MAX_IMAGE_BYTES / 1024 / 1024}MB`;
    if (!input.mainImageContentType?.startsWith("image/")) return "mainImageContentType must be an image/* type";
  }

  const [audit] = await sql`
    insert into outbound_audits (prospect_id, kind, headline, findings, helium10_calls, original_image_url)
    values (${input.prospectId}, ${input.kind}, ${input.headline}, ${JSON.stringify(input.findings)}::jsonb,
            ${input.helium10Calls}, ${input.originalImageUrl})
    returning id, share_token
  `;

  if (image) {
    const key = audit.id as string;
    await getStore(IMAGE_STORE).set(key, new Uint8Array(image).buffer as ArrayBuffer, {
      metadata: { contentType: input.mainImageContentType },
    });
    await sql`
      update outbound_audits set main_image_blob_key = ${key}, main_image_content_type = ${input.mainImageContentType}
      where id = ${audit.id}
    `;
  }

  await sql`update outbound_prospects set status = 'audited', updated_at = now() where id = ${input.prospectId}`;
  return { auditId: audit.id, shareToken: audit.share_token };
}

// ---------------------------------------------------------------------------------------------
// Reads

export interface AuditView {
  id: string;
  prospectId: string;
  companyName: string;
  kind: AuditKind;
  status: AuditStatus;
  shareToken: string;
  headline: string | null;
  findings: AuditFindings;
  originalImageUrl: string | null;
  hasMainImageConcept: boolean;
  helium10Calls: number | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
}

const EMPTY_FINDINGS: AuditFindings = {
  summary: "",
  keywordGaps: [],
  competitorBenchmark: [],
  imageStackFixes: [],
  aPlusFixes: [],
  adsGaps: [],
  launchOpportunity: null,
  mainImageNotes: null,
};

function toAuditView(r: any): AuditView {
  return {
    id: r.id,
    prospectId: r.prospect_id,
    companyName: r.company_name,
    kind: r.kind,
    status: r.status,
    shareToken: r.share_token,
    headline: r.headline,
    findings: { ...EMPTY_FINDINGS, ...(r.findings ?? {}) },
    originalImageUrl: r.original_image_url,
    hasMainImageConcept: !!r.main_image_blob_key,
    helium10Calls: r.helium10_calls,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at ? new Date(r.reviewed_at).toISOString() : null,
    reviewNote: r.review_note,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

export async function getAuditByToken(token: string): Promise<AuditView | null> {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const sql = getDb();
  const [r] = await sql`
    select a.*, p.company_name from outbound_audits a join outbound_prospects p on p.id = a.prospect_id
    where a.share_token = ${token}
  `;
  return r ? toAuditView(r) : null;
}

export async function getAuditsForProspect(prospectId: string): Promise<AuditView[]> {
  const sql = getDb();
  const rows = await sql`
    select a.*, p.company_name from outbound_audits a join outbound_prospects p on p.id = a.prospect_id
    where a.prospect_id = ${prospectId}
    order by a.created_at desc
  `;
  return rows.map(toAuditView);
}

export async function getAuditImage(token: string): Promise<{ data: ReadableStream; contentType: string; status: AuditStatus } | null> {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const sql = getDb();
  const [r] = await sql`select status, main_image_blob_key from outbound_audits where share_token = ${token}`;
  if (!r?.main_image_blob_key) return null;
  const blob = await getStore(IMAGE_STORE).getWithMetadata(r.main_image_blob_key, { type: "stream" });
  if (!blob) return null;
  return {
    data: blob.data as ReadableStream,
    contentType: (blob.metadata?.contentType as string) || "image/png",
    status: r.status,
  };
}

// ---------------------------------------------------------------------------------------------
// Review (the pilot gate)

/** Approving makes the public link live and moves the prospect to "ready to send". Rejecting
 * keeps the link dark and leaves the prospect at "audited" with the note, so the format feedback
 * is kept next to the audit it's about. */
export async function reviewAudit(auditId: string, decision: "approved" | "rejected", note: string | null, reviewer: string): Promise<void> {
  const sql = getDb();
  const [a] = await sql`
    update outbound_audits
    set status = ${decision}, review_note = ${note}, reviewed_by = ${reviewer}, reviewed_at = now()
    where id = ${auditId}
    returning prospect_id
  `;
  if (!a) return;
  if (decision === "approved") {
    await sql`
      update outbound_prospects set status = 'ready', updated_at = now()
      where id = ${a.prospect_id} and status in ('audited', 'audit_pending')
    `;
  }
}

export interface PilotStats {
  total: number;
  approved: number;
  rejected: number;
  draft: number;
  avgHelium10Calls: number | null;
  avgCostPerAudit: number | null;
  helium10CallsThisMonth: number;
  awaitingAudit: number;
}

export async function getPilotStats(): Promise<PilotStats> {
  const sql = getDb();
  const [[a], [q]] = await Promise.all([
    sql`
      select count(*)::int as total,
             count(*) filter (where status = 'approved')::int as approved,
             count(*) filter (where status = 'rejected')::int as rejected,
             count(*) filter (where status = 'draft')::int as draft,
             avg(helium10_calls)::float as avg_calls,
             coalesce(sum(helium10_calls) filter (where created_at >= date_trunc('month', now())), 0)::int as month_calls
      from outbound_audits
    `,
    sql`select count(*)::int as n from outbound_prospects where status = 'scored' and tier in ('A', 'B')`,
  ]);
  const avg = a.avg_calls === null ? null : Number(a.avg_calls);
  return {
    total: a.total,
    approved: a.approved,
    rejected: a.rejected,
    draft: a.draft,
    avgHelium10Calls: avg,
    avgCostPerAudit: avg === null ? null : avg * HELIUM10_COST_PER_CALL,
    helium10CallsThisMonth: a.month_calls,
    awaitingAudit: q.n,
  };
}
