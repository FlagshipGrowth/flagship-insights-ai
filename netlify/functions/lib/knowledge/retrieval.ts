import { getDb } from "../db";
import { embedText } from "./embeddings";

export interface RelevantChunk {
  id: string;
  source: string;
  content: string;
  distance: number;
}

/** Retrieves the closest knowledge chunks for a brand — always house-tier chunks plus that
 * brand's OWN client-tier chunks, never another brand's. This is the enforcement point
 * SPEC.md §7/§11 calls for ("client-tier retrieval can't cross brands") — query through this,
 * don't hand-roll another query against knowledge_chunks elsewhere. */
export async function getRelevantChunks(brandId: string, query: string, limit = 5): Promise<RelevantChunk[]> {
  const sql = getDb();
  const queryEmbedding = await embedText(query);
  const embeddingLiteral = JSON.stringify(queryEmbedding);

  const rows = await sql`
    select id, source, content, embedding <=> ${embeddingLiteral}::vector as distance
    from knowledge_chunks
    where scope = 'house' or brand_id = ${brandId}
    order by distance asc
    limit ${limit}
  `;

  return rows as unknown as RelevantChunk[];
}
