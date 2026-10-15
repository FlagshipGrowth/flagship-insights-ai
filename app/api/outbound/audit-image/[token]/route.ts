import { getAuditImage } from "@/lib/outbound-audit";
import { getUserContext, isOwner } from "@/lib/user-context";

// The AI main-image concept on an audit page. Public once the audit is approved (the prospect
// sees it); before that, only owners previewing the draft can load it.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const image = await getAuditImage(token);
  if (!image) return new Response("Not found", { status: 404 });

  if (image.status !== "approved") {
    const ctx = await getUserContext();
    if (!ctx || !isOwner(ctx)) return new Response("Not found", { status: 404 });
  }

  return new Response(image.data, {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": image.status === "approved" ? "public, max-age=3600" : "private, no-store",
    },
  });
}
