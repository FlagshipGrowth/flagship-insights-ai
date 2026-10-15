import type { Config } from "@netlify/functions";
import { syncFromInstantly } from "../../lib/outbound-sequencer";

// Every 15 minutes, all week: pulls the Instantly campaign's sends and replies, in case a webhook
// was missed. Replies stop the sequence and get classified the same way either route.
export default async () => {
  const result = await syncFromInstantly().catch((err) => ({ error: (err as Error).message }));
  console.log("outbound-instantly-sync", JSON.stringify(result));
  return new Response(JSON.stringify(result));
};

export const config: Config = { schedule: "*/15 * * * *" };
