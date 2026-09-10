import type { MetricRow } from "../db";

export interface ChannelConnection {
  brandId: string;
  channel: string;
  tokens: Record<string, unknown>; // decrypted at call time, never logged
}

/**
 * Pulls one brand's Amazon metrics (Ads + SP-API) for a given day and normalizes them into
 * metrics_daily rows. Stubbed until the Amazon SP-API developer application (Phase 1,
 * docs/phase1-amazon-application.md) is approved and a real LWA connection exists —
 * calling this today throws rather than silently returning fake data.
 */
export async function syncAmazonMetrics(
  connection: ChannelConnection,
  date: string
): Promise<MetricRow[]> {
  throw new Error(
    "syncAmazonMetrics is not implemented yet — waiting on Amazon SP-API developer approval " +
      "(see docs/phase1-amazon-application.md). Wire this up once LWA credentials exist."
  );
}

export const CHANNEL_SYNCERS: Record<
  string,
  (connection: ChannelConnection, date: string) => Promise<MetricRow[]>
> = {
  amazon: syncAmazonMetrics,
};
