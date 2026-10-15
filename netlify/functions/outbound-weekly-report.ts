import type { Config } from "@netlify/functions";
import { formatReportForSlack, getOutboundReport } from "../../lib/outbound-report";
import { postSlackMessage } from "../../lib/slack";

// Mondays 13:05 UTC: last week's outbound numbers to Slack. The full report (with the scoring
// re-weight suggestion) is at /internal/crm/outbound/report.
export default async () => {
  const report = await getOutboundReport(7);
  const channel = process.env.OUTBOUND_SLACK_CHANNEL_ID;
  if (channel && process.env.SLACK_BOT_TOKEN) {
    await postSlackMessage({
      channel,
      text: `${formatReportForSlack(report)}\n<${process.env.URL}/internal/crm/outbound/report|Full report>`,
    });
  }
  return new Response("ok");
};

export const config: Config = { schedule: "5 13 * * 1" };
