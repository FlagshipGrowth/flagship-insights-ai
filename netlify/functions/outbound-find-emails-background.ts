import { findEmailForProspect, findEmailsBatch } from "../../lib/outbound-email-finder";

// Step 1 for a new brand: find a verified email with Apollo before anything is spent auditing it.
// Called by /api/outbound/ingest with the brands it just added; with no ids, it works through the
// next batch still missing an email.
export default async (req: Request) => {
  if (req.headers.get("authorization") !== `Bearer ${process.env.OUTBOUND_SYNC_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body?.prospectIds) ? body.prospectIds.filter((x: unknown) => typeof x === "string").slice(0, 50) : [];
  const results = [];
  if (ids.length > 0) {
    for (const id of ids) results.push(await findEmailForProspect(id).catch((err) => ({ prospectId: id, error: (err as Error).message })));
  } else {
    results.push(...(await findEmailsBatch(25)));
  }
  console.log("outbound-find-emails", JSON.stringify(results));
};
