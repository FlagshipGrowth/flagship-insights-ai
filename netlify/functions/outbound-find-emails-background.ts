import { findEmailsBatch } from "../../lib/outbound-email-finder";

// "Find emails with Apollo" on /internal/crm/outbound. A batch is a few Apollo calls per brand,
// which can outlast a normal request, hence a background function.
export default async (req: Request) => {
  if (req.headers.get("authorization") !== `Bearer ${process.env.OUTBOUND_SYNC_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const results = await findEmailsBatch(25);
  console.log("outbound-find-emails", JSON.stringify(results));
};
