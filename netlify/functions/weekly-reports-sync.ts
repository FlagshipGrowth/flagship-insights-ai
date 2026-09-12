import type { Config } from "@netlify/functions";
import { syncAllWeeklyReports } from "./lib/reports/sync";

export default async () => {
  const result = await syncAllWeeklyReports();
  return new Response(JSON.stringify(result), { status: 200 });
};

export const config: Config = { schedule: "@daily" };
