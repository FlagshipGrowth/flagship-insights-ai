import { createSign } from "node:crypto";
import { getDb } from "../db";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const HEADER_SCAN_LIMIT = 20;
const ASIN_PATTERN = /^[A-Z0-9]{10}$/;

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function getServiceAccountCredentials(): { clientEmail: string; privateKey: string } {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  if (!clientEmail || !privateKeyRaw) {
    throw new Error("GOOGLE_SHEETS_CLIENT_EMAIL / GOOGLE_SHEETS_PRIVATE_KEY are not set.");
  }
  // The key is stored as a single-line env var with literal "\n" escapes — unescape before use.
  return { clientEmail, privateKey: privateKeyRaw.replace(/\\n/g, "\n") };
}

/** Mints a short-lived access token for the catalog-sync service account via the JWT bearer
 * flow (RFC 7523), hand-rolled with node:crypto — this is the only Google API this project
 * talks to, so it doesn't warrant pulling in google-auth-library/googleapis. */
async function getAccessToken(): Promise<string> {
  const { clientEmail, privateKey } = getServiceAccountCredentials();
  const now = Math.floor(Date.now() / 1000);

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({ iss: clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 })
  );
  const signingInput = `${header}.${claims}`;
  const signature = base64url(createSign("RSA-SHA256").update(signingInput).sign(privateKey));
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function resolveSheetTitle(spreadsheetId: string, gid: string, accessToken: string): Promise<string> {
  const url = `${SHEETS_API}/${spreadsheetId}?fields=sheets.properties(sheetId,title)`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new Error(`Failed to read spreadsheet metadata for ${spreadsheetId} (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { sheets: { properties: { sheetId: number; title: string } }[] };
  const sheet = data.sheets.find((s) => String(s.properties.sheetId) === gid);
  if (!sheet) {
    throw new Error(`No tab with gid ${gid} found in spreadsheet ${spreadsheetId}`);
  }
  return sheet.properties.title;
}

async function fetchSheetRows(spreadsheetId: string, gid: string, accessToken: string): Promise<string[][]> {
  const title = await resolveSheetTitle(spreadsheetId, gid, accessToken);
  // A bare sheet-name range (no A1 cell bounds) means "the whole tab" — avoids guessing how
  // many columns a given brand's sheet uses.
  const range = encodeURIComponent(`'${title}'`);
  const url = `${SHEETS_API}/${spreadsheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new Error(`Failed to read sheet values for ${spreadsheetId} (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { values?: unknown[][] };
  return (data.values ?? []).map((row) => row.map((cell) => (cell == null ? "" : String(cell))));
}

type ColumnField =
  | "asin"
  | "title"
  | "status"
  | "category"
  | "subCategory"
  | "productType"
  | "upc"
  | "costLanded"
  | "msrp"
  | "unitWeight"
  | "caseQty"
  | "caseWeight"
  | "caseLength"
  | "caseWidth"
  | "caseHeight";

type ColumnMap = Partial<Record<ColumnField, number>>;

/** Every brand's master spec sheet was built independently, so column order and exact header
 * wording differ brand to brand (e.g. "UPC" vs "EAN Number" vs "ISBN", "Product Type" vs
 * "Product Line"). Map by header text instead of position, and fall back to `raw` for anything
 * that doesn't fit these normalized fields. */
function mapHeaderRow(headers: string[]): ColumnMap {
  const norm = headers.map((h) => h.trim().toLowerCase());
  const find = (test: (h: string) => boolean) => {
    const i = norm.findIndex(test);
    return i === -1 ? undefined : i;
  };

  // Dimension columns are the trickiest: some sheets merge a "Unit Dimension"/"Case Dimension"
  // group header with the ASIN row and push the actual "Weight/L/W/H" sub-labels to the row
  // below (see mergeHeaderRows) — after merging, those become e.g. "case dimension weight" /
  // "unit dimension l". Match on the group keyword plus a bare-letter word boundary rather than
  // requiring an exact "weight"/"l" cell, since a real column is rarely that bare on its own.
  const isCase = (h: string) => h.includes("case");
  const bare = (h: string, letter: string) => new RegExp(`\\b${letter}\\b`).test(h);

  const map: ColumnMap = {
    // startsWith, not includes: a couple of brands write "ASIN (Child)", but a sheet with an
    // unrelated column like "Merchant Existing Asin" (seen on WINK's linked spreadsheet, which
    // turned out to point at a raw Amazon bulk-upload tab rather than a real spec sheet) should
    // NOT be mistaken for a product-spec header row just because "asin" appears in it somewhere.
    asin: find((h) => h.startsWith("asin")),
    title: find((h) => h.includes("product name") || h === "title"),
    category: find((h) => h === "category"),
    subCategory: find((h) => h.includes("sub category") || h.includes("subcategory")),
    productType: find((h) => h.includes("product type") || h.includes("product line")),
    upc: find((h) => h.includes("upc") || h.includes("ean") || h.includes("isbn")),
    costLanded: find((h) => h.includes("cost")),
    msrp: find((h) => h.includes("msrp")),
    unitWeight: find((h) => h.includes("weight") && !isCase(h)),
    caseQty: find((h) => isCase(h) && (h.includes("qty") || h.includes("quantity") || h.includes("count"))),
    caseWeight: find((h) => isCase(h) && h.includes("weight")),
    caseLength: find((h) => isCase(h) && (h.includes("length") || bare(h, "l"))),
    caseWidth: find((h) => isCase(h) && (h.includes("width") || bare(h, "w"))),
    caseHeight: find((h) => isCase(h) && (h.includes("height") || bare(h, "h"))),
    // Amazon is the only live channel (see CLAUDE.md) — prefer an AMZ-specific active/disco
    // column over the TTS/WMT ones some brands' sheets also track.
    status: find((h) => h.includes("active") && h.includes("amz")) ?? find((h) => h.includes("active")),
  };

  return map;
}

/** Some brands' sheets carry a group label ("Unit Dimension", "Case Dimension") in the same
 * row as the other column headers, with the actual sub-labels ("Weight", "L", "W", "H", "QTY")
 * one row below — a merged-cell layout that looks like two header rows once read as plain
 * values. Fold the sub-label row into the group row so mapHeaderRow only ever sees one row,
 * carrying the nearest group label forward into blank sub-header cells. */
function mergeHeaderRows(groupRow: string[], subRow: string[]): string[] {
  const combined: string[] = [];
  let lastGroup = "";
  const len = Math.max(groupRow.length, subRow.length);
  for (let i = 0; i < len; i++) {
    const groupCell = (groupRow[i] ?? "").trim();
    if (groupCell) lastGroup = groupCell;
    const subCell = (subRow[i] ?? "").trim();
    if (subCell) {
      combined[i] = groupCell ? `${groupCell} ${subCell}` : `${lastGroup} ${subCell}`;
    } else {
      combined[i] = groupCell;
    }
  }
  return combined;
}

function parseStatus(value: string | undefined): "active" | "discontinued" | null {
  const s = (value ?? "").trim().toLowerCase();
  if (s.startsWith("disco")) return "discontinued"; // "Disco", "Discontinued"
  if (s.startsWith("active")) return "active";
  return null;
}

function parseNumber(value: string | undefined): number | null {
  if (value === undefined || value === "") return null;
  const n = Number(value);
  if (Number.isFinite(n)) return n;
  // A few brands write case/unit weights with a trailing unit, e.g. "12lb" — strip anything
  // that isn't part of a number and retry rather than losing the value entirely.
  const stripped = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(stripped) && value.replace(/[^0-9.-]/g, "") !== "" ? stripped : null;
}

function parseText(value: string | undefined): string | null {
  const s = (value ?? "").trim();
  return s || null;
}

export interface ParsedProduct {
  asin: string;
  title: string | null;
  status: "active" | "discontinued" | null;
  category: string | null;
  subCategory: string | null;
  productType: string | null;
  upc: string | null;
  costLanded: number | null;
  msrp: number | null;
  unitWeight: number | null;
  caseQty: number | null;
  caseWeight: number | null;
  caseLength: number | null;
  caseWidth: number | null;
  caseHeight: number | null;
  raw: Record<string, string>;
}

function parseRow(headers: string[], row: string[], map: ColumnMap): ParsedProduct | null {
  // Google Sheets omits trailing blank cells per row, so a row can be shorter than the
  // asin column index (e.g. a spacer row with data only in earlier columns) — row[map.asin]
  // is then undefined, not "".
  const asin = (map.asin !== undefined ? row[map.asin] ?? "" : "").trim().toUpperCase();
  // Filters out blank rows, brand notes ("NOTE: all SideKick items above are FBA"), and any
  // stray repeated header row — none of those look like a real 10-character ASIN.
  if (!ASIN_PATTERN.test(asin)) return null;

  const cell = (idx: number | undefined) => (idx === undefined ? undefined : row[idx]);
  const raw: Record<string, string> = {};
  headers.forEach((header, i) => {
    const key = header.trim();
    const value = row[i];
    if (key && value) raw[key] = value;
  });

  return {
    asin,
    title: parseText(cell(map.title)),
    status: parseStatus(cell(map.status)),
    category: parseText(cell(map.category)),
    subCategory: parseText(cell(map.subCategory)),
    productType: parseText(cell(map.productType)),
    upc: parseText(cell(map.upc)),
    costLanded: parseNumber(cell(map.costLanded)),
    msrp: parseNumber(cell(map.msrp)),
    unitWeight: parseNumber(cell(map.unitWeight)),
    caseQty: parseNumber(cell(map.caseQty)),
    caseWeight: parseNumber(cell(map.caseWeight)),
    caseLength: parseNumber(cell(map.caseLength)),
    caseWidth: parseNumber(cell(map.caseWidth)),
    caseHeight: parseNumber(cell(map.caseHeight)),
    raw,
  };
}

function findHeaderRow(rows: string[][]): { index: number; headers: string[] } | null {
  for (let i = 0; i < Math.min(rows.length, HEADER_SCAN_LIMIT); i++) {
    const asinCol = rows[i].findIndex((cell) => cell.trim().toLowerCase().startsWith("asin"));
    if (asinCol === -1) continue;

    // If the row right after this one doesn't look like a real product row (no valid ASIN in
    // that same column), it's a merged-header sub-label row, not data — fold it in.
    const nextRow = rows[i + 1];
    const nextLooksLikeData = nextRow && ASIN_PATTERN.test((nextRow[asinCol] ?? "").trim().toUpperCase());
    if (nextRow && !nextLooksLikeData) {
      return { index: i + 1, headers: mergeHeaderRows(rows[i], nextRow) };
    }
    return { index: i, headers: rows[i] };
  }
  return null;
}

export function parseCatalogRows(rows: string[][]): ParsedProduct[] {
  const header = findHeaderRow(rows);
  if (!header) return [];
  const map = mapHeaderRow(header.headers);

  const products: ParsedProduct[] = [];
  for (let i = header.index + 1; i < rows.length; i++) {
    const parsed = parseRow(header.headers, rows[i], map);
    if (parsed) products.push(parsed);
  }
  return products;
}

export async function upsertProducts(brandId: string, products: ParsedProduct[]): Promise<void> {
  const sql = getDb();
  for (const p of products) {
    await sql`
      insert into products (
        brand_id, asin, title, status, category, sub_category, product_type, upc,
        cost_landed, msrp, unit_weight, case_qty, case_weight, case_length, case_width, case_height,
        raw, last_synced_at
      ) values (
        ${brandId}, ${p.asin}, ${p.title}, ${p.status}, ${p.category}, ${p.subCategory}, ${p.productType}, ${p.upc},
        ${p.costLanded}, ${p.msrp}, ${p.unitWeight}, ${p.caseQty}, ${p.caseWeight}, ${p.caseLength}, ${p.caseWidth}, ${p.caseHeight},
        ${JSON.stringify(p.raw)}, now()
      )
      on conflict (brand_id, asin) do update set
        title = excluded.title,
        status = excluded.status,
        category = excluded.category,
        sub_category = excluded.sub_category,
        product_type = excluded.product_type,
        upc = excluded.upc,
        cost_landed = excluded.cost_landed,
        msrp = excluded.msrp,
        unit_weight = excluded.unit_weight,
        case_qty = excluded.case_qty,
        case_weight = excluded.case_weight,
        case_length = excluded.case_length,
        case_width = excluded.case_width,
        case_height = excluded.case_height,
        raw = excluded.raw,
        last_synced_at = excluded.last_synced_at
    `;
  }
}

export interface BrandSheetRef {
  id: string;
  googleSheetId: string;
  googleSheetSpecsGid: string;
}

export interface CatalogSyncResult {
  brandId: string;
  productCount: number;
}

export async function syncBrandCatalog(brand: BrandSheetRef, accessToken: string): Promise<CatalogSyncResult> {
  const syncStartedAt = new Date();
  const rows = await fetchSheetRows(brand.googleSheetId, brand.googleSheetSpecsGid, accessToken);
  const products = parseCatalogRows(rows);
  await upsertProducts(brand.id, products);
  // Anything from a previous sync that wasn't touched just now is either genuinely discontinued
  // off the sheet or (as happened once with a brand whose linked gid pointed at the wrong tab)
  // was never really the brand's catalog to begin with — either way, it shouldn't linger.
  const sql = getDb();
  await sql`delete from products where brand_id = ${brand.id} and last_synced_at < ${syncStartedAt.toISOString()}`;
  return { brandId: brand.id, productCount: products.length };
}

/** Syncs every brand that has a linked Google Sheet. One access token is minted and reused
 * across all brands — Google's per-minute quota has no trouble with ~25 read requests, and
 * a token is good for an hour anyway. Brand failures don't stop the run (see sync-nightly.ts
 * for the same per-connection isolation pattern with metrics_daily). */
export async function syncAllCatalogs(): Promise<{ synced: number; failed: number }> {
  const sql = getDb();
  const brands = (await sql`
    select id, google_sheet_id, google_sheet_specs_gid
    from brands
    where google_sheet_id is not null
  `) as { id: string; google_sheet_id: string; google_sheet_specs_gid: string | null }[];

  const accessToken = await getAccessToken();

  const results = await Promise.allSettled(
    brands.map((b) =>
      syncBrandCatalog(
        { id: b.id, googleSheetId: b.google_sheet_id, googleSheetSpecsGid: b.google_sheet_specs_gid ?? "0" },
        accessToken
      )
    )
  );

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.error(`catalog-sync: ${failures.length}/${brands.length} brands failed`, failures);
  }
  return { synced: brands.length - failures.length, failed: failures.length };
}
