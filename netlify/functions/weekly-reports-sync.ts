import type { Config } from "@netlify/functions";
import { syncAllWeeklyReports, syncAllInventoryReports, syncAllReconciliationReports } from "./lib/reports/sync";

export default async () => {
  const [weekly, inventory, reconciliation] = await Promise.all([
    syncAllWeeklyReports(),
    syncAllInventoryReports(),
    syncAllReconciliationReports(),
  ]);
  return new Response(JSON.stringify({ weekly, inventory, reconciliation }), { status: 200 });
};

export const config: Config = { schedule: "@daily" };
