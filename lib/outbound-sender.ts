// The one place outbound email actually leaves the building. Each sending tool (Instantly,
// Smartlead, Gmail API, ...) gets an entry in SENDERS, the same registry pattern the metrics
// pipeline uses for channels. OUTBOUND_SENDER picks one. None is registered yet: Joey hasn't chosen
// the tool, and the outreach domains and inboxes don't exist yet. Until one is, nothing can send,
// and the engine says so instead of pretending.

export interface OutboundEmail {
  to: string;
  toName: string | null;
  subject: string;
  body: string;
  // Stable per prospect so every step lands in one thread with the same inbox.
  threadKey: string;
  // The sending tool's id for the previous email in the thread, for In-Reply-To threading.
  previousExternalId: string | null;
}

export interface SendResult {
  externalId: string;
  inbox: string;
}

export interface OutboundSender {
  name: string;
  send(email: OutboundEmail): Promise<SendResult>;
}

const SENDERS: Record<string, () => OutboundSender> = {
  // e.g. instantly: () => createInstantlySender(process.env.INSTANTLY_API_KEY!),
};

export function getSender(): OutboundSender | null {
  const name = process.env.OUTBOUND_SENDER;
  if (!name) return null;
  const factory = SENDERS[name];
  return factory ? factory() : null;
}

export function senderStatus(): { configured: boolean; message: string } {
  const name = process.env.OUTBOUND_SENDER;
  if (!name) return { configured: false, message: "No sending tool connected yet (OUTBOUND_SENDER is not set)." };
  if (!SENDERS[name]) return { configured: false, message: `OUTBOUND_SENDER is "${name}", which isn't a connected sending tool.` };
  return { configured: true, message: `Sending through ${name}.` };
}
