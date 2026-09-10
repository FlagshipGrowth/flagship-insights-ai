// Requires a Google Cloud OAuth client with the gmail.readonly scope, verified if the consent
// screen needs to leave testing mode — a Google review, not just a signup. See
// docs/phase4-knowledge-sources.md. Not this session's interactive Gmail access (Joey's own
// personal integration, not a server-side OAuth app this product can run unattended).
export async function fetchGmailThreads(sinceIso: string): Promise<string[]> {
  throw new Error(
    "fetchGmailThreads is not implemented yet — needs a verified Google OAuth client " +
      "(see docs/phase4-knowledge-sources.md). Wire this up once that exists."
  );
}
