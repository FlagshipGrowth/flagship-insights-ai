import { getDb } from "../db";
import { embedText } from "./embeddings";

const MAX_CHUNK_CHARS = 1000;

/** Splits on paragraph breaks and packs them into ~MAX_CHUNK_CHARS chunks — good enough for
 * call transcripts, emails, and Slack threads. Revisit if a source needs smarter splitting
 * (e.g. code blocks, structured docs) once there's a real one to test against. */
export function chunkText(content: string): string[] {
  const paragraphs = content.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (current.length > 0 && current.length + para.length > MAX_CHUNK_CHARS) {
      chunks.push(current);
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export interface IngestParams {
  scope: "house" | "client";
  brandId: string | null; // required when scope === "client"
  source: string; // e.g. "slack:#client-bb-bands", "gmail:thread-123", "fathom:call-456"
  content: string;
}

export async function ingestDocument({ scope, brandId, source, content }: IngestParams): Promise<number> {
  if (scope === "client" && !brandId) {
    throw new Error("brandId is required when scope is 'client' — see the client_scope_requires_brand constraint.");
  }

  const sql = getDb();
  const chunks = chunkText(content);

  for (const chunk of chunks) {
    const embedding = await embedText(chunk);
    await sql`
      insert into knowledge_chunks (scope, brand_id, source, content, embedding)
      values (${scope}, ${brandId}, ${source}, ${chunk}, ${JSON.stringify(embedding)})
    `;
  }

  return chunks.length;
}
