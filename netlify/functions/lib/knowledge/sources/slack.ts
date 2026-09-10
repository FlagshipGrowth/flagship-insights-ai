// Requires Flagship's own Slack app (not this session's interactive Slack access, which is
// Joey's personal integration, not a server-side OAuth app this product can run unattended).
// See docs/phase4-knowledge-sources.md for what creating that app involves.
export async function fetchSlackMessages(channelId: string, sinceIso: string): Promise<string[]> {
  throw new Error(
    "fetchSlackMessages is not implemented yet — needs a Flagship Slack app installed to the " +
      "workspace (see docs/phase4-knowledge-sources.md). Wire this up once that exists."
  );
}
