import type { Config } from "@netlify/functions";
import { syncAllCatalogs } from "./lib/catalog/google-sheets";

export default async () => {
  const result = await syncAllCatalogs();
  return new Response(JSON.stringify(result), { status: 200 });
};

export const config: Config = { schedule: "@daily" };
