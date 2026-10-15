import type { Config } from "@netlify/functions";
import { sendDueEmails } from "../../lib/outbound-sequencer";

// Every 15 minutes through the US business day on weekdays, a small batch at a time: spreading
// sends out is better for deliverability than one daily blast, and keeps each run well inside the
// function time limit. Does nothing until sending is turned on and a sending tool is connected.
export default async () => {
  const result = await sendDueEmails(12);
  console.log("outbound-send", JSON.stringify(result));
  return new Response(JSON.stringify(result));
};

export const config: Config = { schedule: "*/15 13-23 * * 1-5" };
