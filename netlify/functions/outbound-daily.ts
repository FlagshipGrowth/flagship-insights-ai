import type { Config } from "@netlify/functions";

// Weekdays at 12:15 UTC (early morning US time): hands off to the background function, since the
// run writes copy with Claude and can take minutes.
export default async () => {
  const res = await fetch(`${process.env.URL}/.netlify/functions/outbound-daily-background`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.OUTBOUND_SYNC_SECRET}` },
  });
  return new Response(`daily run triggered: ${res.status}`);
};

export const config: Config = { schedule: "15 12 * * 1-5" };
