import { getDb } from "./db";
import { normalizeDomain } from "./outbound";

// Finds a brand's decision-maker and a verified work email with Apollo (APOLLO_API_KEY). Sourcing
// can't verify emails itself, and the engine never emails an unverified address, so this is what
// turns a scored brand into one that can be contacted. Only Apollo's "verified" status counts.
//
// Flow per brand: if sourcing already found a person, look them up by name + domain; otherwise
// search the domain for a founder/owner/C-level, then an e-commerce lead, and enrich the best
// match. Runs automatically right after a brand's audit is posted, and daily for any brand still
// missing an email. Every lookup is
// remembered (email_lookup_at/result) so a brand isn't re-checked and re-billed every day.

const APOLLO = "https://api.apollo.io/api/v1";
const RECHECK_DAYS = 30;

export function apolloConfigured(): boolean {
  return !!process.env.APOLLO_API_KEY;
}

async function apollo(path: string, params: Record<string, string | string[]>): Promise<any> {
  const key = process.env.APOLLO_API_KEY;
  if (!key) throw new Error("APOLLO_API_KEY is not set");
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((x) => q.append(`${k}[]`, x));
    else q.set(k, v);
  }
  const res = await fetch(`${APOLLO}${path}?${q}`, {
    method: "POST",
    headers: { "x-api-key": key, "content-type": "application/json", "cache-control": "no-cache" },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Apollo ${path} failed (${res.status}): ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : {};
}

interface FoundPerson {
  fullName: string | null;
  title: string | null;
  email: string | null;
  verified: boolean;
  linkedinUrl: string | null;
}

function toFound(p: any): FoundPerson | null {
  if (!p) return null;
  const email = typeof p.email === "string" && p.email.includes("@") ? p.email.trim().toLowerCase() : null;
  return {
    fullName: p.name ?? ([p.first_name, p.last_name].filter(Boolean).join(" ") || null),
    title: p.title ?? null,
    email,
    verified: !!email && String(p.email_status ?? "").toLowerCase() === "verified",
    linkedinUrl: p.linkedin_url ?? null,
  };
}

// Joey (2026-10-15): founder/owner/CEO first; if none has a verified email, the person who runs
// e-commerce, Amazon or marketplaces.
const LEADERS = { person_seniorities: ["founder", "owner", "c_suite"] };
const ECOM_LEADS = {
  person_titles: ["ecommerce", "e-commerce", "amazon", "marketplace", "digital commerce"],
  person_seniorities: ["vp", "head", "director"],
};

async function searchAndVerify(domain: string, filter: Record<string, string[]>): Promise<FoundPerson | null> {
  const search = await apollo("/mixed_people/api_search", { q_organization_domains_list: [domain], ...filter, per_page: "5" });
  const candidates: any[] = (search.people ?? []).filter((p: any) => p?.id);
  // Prefer people Apollo says have an email.
  candidates.sort((a, b) => Number(!!b.has_email) - Number(!!a.has_email));
  for (const c of candidates.slice(0, 2)) {
    const found = toFound((await apollo("/people/match", { id: c.id, reveal_personal_emails: "false" })).person);
    if (found?.verified) return found;
  }
  return null;
}

async function findPerson(domain: string, knownName: string | null, knownLinkedin: string | null): Promise<FoundPerson | null> {
  if (knownLinkedin || knownName) {
    const params: Record<string, string> = { domain, reveal_personal_emails: "false" };
    if (knownLinkedin) params.linkedin_url = knownLinkedin;
    if (knownName) params.name = knownName;
    const found = toFound((await apollo("/people/match", params)).person);
    if (found?.verified) return found;
  }
  return (await searchAndVerify(domain, LEADERS)) ?? (await searchAndVerify(domain, ECOM_LEADS));
}

export interface LookupResult {
  prospectId: string;
  companyName: string;
  result: string;
  email: string | null;
}

/** Looks up one brand's verified email and saves it as a contact. */
export async function findEmailForProspect(prospectId: string): Promise<LookupResult> {
  const sql = getDb();
  const [p] = (await sql`select id, company_name, website from outbound_prospects where id = ${prospectId}`) as any[];
  if (!p) return { prospectId, companyName: "?", result: "Unknown brand", email: null };
  const done = async (result: string, email: string | null): Promise<LookupResult> => {
    await sql`update outbound_prospects set email_lookup_at = now(), email_lookup_result = ${result} where id = ${prospectId}`;
    return { prospectId, companyName: p.company_name, result, email };
  };

  const domain = p.website ? normalizeDomain(p.website) : null;
  if (!domain) return done("No website on file, so there's no domain to search", null);

  const contacts = (await sql`
    select * from outbound_contacts where prospect_id = ${prospectId} order by is_primary desc, created_at
  `) as any[];
  if (contacts.some((c) => c.email && c.email_verified)) return done("Already has a verified email", null);
  const known = contacts[0];

  let found: FoundPerson | null;
  try {
    found = await findPerson(domain, known?.full_name ?? null, known?.linkedin_url ?? null);
  } catch (err) {
    // Not remembered as a lookup, so a temporary Apollo error is retried next run.
    return { prospectId, companyName: p.company_name, result: (err as Error).message, email: null };
  }
  if (!found?.email) return done("Apollo found no verified email for a founder, CEO or e-commerce lead", null);

  // The same person is never sequenced under two brands (unique index on lower(email)).
  const [taken] = (await sql`
    select prospect_id from outbound_contacts where lower(email) = ${found.email} and prospect_id <> ${prospectId}
  `) as any[];
  if (taken) return done(`${found.email} already belongs to another brand in the engine`, null);

  const sameAsKnown =
    known &&
    !known.email &&
    (!known.full_name || !found.fullName || known.full_name.toLowerCase() === found.fullName.toLowerCase());
  if (sameAsKnown) {
    await sql`
      update outbound_contacts
      set email = ${found.email}, email_verified = true, email_source = 'apollo',
          full_name = coalesce(full_name, ${found.fullName}), title = coalesce(title, ${found.title}),
          linkedin_url = coalesce(linkedin_url, ${found.linkedinUrl})
      where id = ${known.id}
    `;
  } else {
    await sql`update outbound_contacts set is_primary = false where prospect_id = ${prospectId}`;
    await sql`
      insert into outbound_contacts (prospect_id, full_name, title, email, email_verified, linkedin_url, is_primary, email_source)
      values (${prospectId}, ${found.fullName}, ${found.title}, ${found.email}, true, ${found.linkedinUrl}, true, 'apollo')
    `;
  }
  return done(`Found ${found.fullName ?? "a contact"} (${found.title ?? "title unknown"})`, found.email);
}

/** Daily: brands worth contacting that still have no verified email, best first. */
export async function findEmailsBatch(limit: number): Promise<LookupResult[]> {
  if (!apolloConfigured() || limit <= 0) return [];
  const sql = getDb();
  const rows = (await sql`
    select p.id from outbound_prospects p
    where p.status in ('ready', 'audited', 'audit_pending', 'scored')
      and (p.email_lookup_at is null or p.email_lookup_at < now() - make_interval(days => ${RECHECK_DAYS}))
      and not exists (select 1 from outbound_contacts c where c.prospect_id = p.id and c.email is not null and c.email_verified)
    order by case p.status when 'ready' then 0 when 'audited' then 1 when 'audit_pending' then 2 else 3 end,
             case p.tier when 'A' then 0 when 'B' then 1 else 2 end, p.score desc nulls last
    limit ${limit}
  `) as any[];
  const out: LookupResult[] = [];
  for (const r of rows) out.push(await findEmailForProspect(r.id));
  return out;
}
