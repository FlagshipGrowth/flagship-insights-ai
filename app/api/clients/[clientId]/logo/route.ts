import { getStore } from "@netlify/blobs";
import { getDb } from "@/lib/db";

// Public by design (no auth check) — a client's logo is meant to be embeddable as a plain
// <img src> anywhere (internal brand pages, a future client-facing header), same as any other
// static brand asset. It reveals nothing beyond the image itself.
export async function GET(_req: Request, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const sql = getDb();
  const rows = await sql`select logo_blob_key from clients where id = ${clientId}`;
  const key = rows[0]?.logo_blob_key as string | null | undefined;
  if (!key) return new Response("Not found", { status: 404 });

  const store = getStore("client-logos");
  const blob = await store.getWithMetadata(key, { type: "stream" });
  if (!blob) return new Response("Not found", { status: 404 });

  return new Response(blob.data as ReadableStream, {
    headers: {
      "Content-Type": (blob.metadata?.contentType as string) || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
