import type { Config } from "@netlify/functions";
import { getAccessToken, syncAllCatalogs } from "./lib/catalog/google-sheets";
import { syncAllForecasts } from "./lib/catalog/forecast-sheets";

export default async () => {
  const catalogResult = await syncAllCatalogs();
  const accessToken = await getAccessToken();
  const forecastResult = await syncAllForecasts(accessToken);
  return new Response(JSON.stringify({ catalog: catalogResult, forecast: forecastResult }), { status: 200 });
};

export const config: Config = { schedule: "@daily" };
