// Requires Flagship's own Fathom API access (a Fathom Team plan + API key), and a decision
// on which calls count as "house" vs a specific client's "client" tier. See
// docs/phase4-knowledge-sources.md. Not this session's interactive Fathom access.
export async function fetchFathomTranscripts(sinceIso: string): Promise<string[]> {
  throw new Error(
    "fetchFathomTranscripts is not implemented yet — needs Fathom API access provisioned " +
      "(see docs/phase4-knowledge-sources.md). Wire this up once that exists."
  );
}
