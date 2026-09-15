import { getMarketingCreativeImage } from "@/lib/marketing";

// Public by design (no auth check) — same as the client logo route: meant to be embeddable as a
// plain <img src>, and reveals nothing beyond the ad image itself.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const image = await getMarketingCreativeImage(id);
  if (!image) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
