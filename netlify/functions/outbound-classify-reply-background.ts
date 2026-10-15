import { classifyReply } from "../../lib/outbound-replies";

// Triggered by lib/outbound-replies.ts's triggerClassification after a reply is recorded. A
// background function because the Claude call can outlast a normal request.
// Imports the app's lib/ by relative path (it only uses relative imports itself), so the reply
// logic lives in one place.
export default async (req: Request) => {
  if (req.headers.get("authorization") !== `Bearer ${process.env.OUTBOUND_SYNC_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { replyId } = await req.json().catch(() => ({}));
  if (typeof replyId !== "string") return new Response("replyId required", { status: 400 });
  const result = await classifyReply(replyId);
  console.log("outbound-classify-reply", replyId, JSON.stringify(result));
};
