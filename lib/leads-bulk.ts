import { csvToRecords } from "./csv";
import { LEAD_STAGES, type LeadStage, type NewLeadInput } from "./leads";

// A few header spellings people are likely to type/paste; the template
// (app/api/crm/bulk-template/route.ts) always uses the first of each.
const HEADER_ALIASES: Record<string, string> = {
  "company name": "companyName",
  company: "companyName",
  "contact name": "contactName",
  contact: "contactName",
  email: "email",
  phone: "phone",
  source: "source",
  "estimated value": "estimatedValue",
  "est. value": "estimatedValue",
  "est value": "estimatedValue",
  value: "estimatedValue",
  stage: "stage",
  notes: "notes",
};

/** For getting a scattered list of warm leads (emails, call notes, spreadsheets) into the CRM at
 * once — app/internal/crm/bulk-upload. Rows missing a company name are silently dropped rather
 * than blocking the whole file, same convention as lib/seo-listing-bulk.ts. */
export function parseLeadsBulkCsv(text: string): { rows: NewLeadInput[]; skipped: number } {
  const records = csvToRecords(text);
  const rows: NewLeadInput[] = [];
  let skipped = 0;

  for (const record of records) {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(record)) {
      const mapped = HEADER_ALIASES[key.trim().toLowerCase()];
      if (mapped) normalized[mapped] = value;
    }

    const companyName = normalized.companyName?.trim();
    if (!companyName) {
      skipped++;
      continue;
    }

    const rawStage = normalized.stage?.trim().toLowerCase();
    const stage: LeadStage = (LEAD_STAGES as readonly string[]).includes(rawStage ?? "") ? (rawStage as LeadStage) : "new";

    const rawValue = normalized.estimatedValue?.trim().replace(/[$,]/g, "");
    const estimatedValue = rawValue && !isNaN(Number(rawValue)) ? Number(rawValue) : null;

    rows.push({
      companyName,
      contactName: normalized.contactName?.trim() || null,
      email: normalized.email?.trim() || null,
      phone: normalized.phone?.trim() || null,
      source: normalized.source?.trim() || null,
      estimatedValue,
      stage,
      notes: normalized.notes?.trim() || null,
    });
  }

  return { rows, skipped };
}
