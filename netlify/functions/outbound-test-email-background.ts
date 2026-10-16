import { pickTestProspect, sendTestToMe } from "../../lib/outbound-instantly-admin";
import { writePreview } from "../../lib/outbound-sequencer";

// "Send a test email to me" on /internal/crm/outbound. Rewrites the latest brand's draft with the
// current copy rules first (so a test never shows an old draft), then sends its first email to the
// owner who clicked. Background because the Claude call can outlast a normal request.
export default async (req: Request) => {
  if (req.headers.get("authorization") !== `Bearer ${process.env.OUTBOUND_SYNC_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { to } = await req.json().catch(() => ({}));
  if (typeof to !== "string" || !to.includes("@")) return new Response("to required", { status: 400 });
  const prospectId = await pickTestProspect();
  if (prospectId) await writePreview(prospectId);
  const note = await sendTestToMe(to, prospectId).catch((err) => `failed: ${(err as Error).message}`);
  console.log("outbound-test-email", note);
};
