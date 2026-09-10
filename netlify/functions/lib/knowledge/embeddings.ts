// Anthropic doesn't offer an embeddings API — Voyage AI is Anthropic's recommended embedding
// provider and is what knowledge_chunks.embedding (vector(1024)) is sized for. Needs its own
// VOYAGE_API_KEY (a normal signup at voyageai.com, not a platform approval).
const VOYAGE_EMBED_URL = "https://api.voyageai.com/v1/embeddings";
const MODEL = "voyage-3";

export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error("VOYAGE_API_KEY is not set — get one at voyageai.com.");
  }

  const response = await fetch(VOYAGE_EMBED_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: [text], model: MODEL }),
  });

  if (!response.ok) {
    throw new Error(`Voyage embeddings request failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { data: { embedding: number[] }[] };
  return data.data[0].embedding;
}
