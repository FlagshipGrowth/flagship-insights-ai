import { writePreview } from "../../lib/outbound-sequencer";

// Triggered by "Preview emails" on a prospect page (lib/outbound-sequencer.ts requestPreview).
// Drafts the brand's email sequence without enrolling it; the page shows the result once
// outbound_prospects.preview_status is 'ready'. Background because the Claude call can outlast a
// normal request.
export default async (req: Request) => {
  if (req.headers.get("authorization") !== `Bearer ${process.env.OUTBOUND_SYNC_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { prospectId } = await req.json().catch(() => ({}));
  if (typeof prospectId !== "string") return new Response("prospectId required", { status: 400 });
  await writePreview(prospectId);
};
