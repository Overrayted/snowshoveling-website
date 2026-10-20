import { timingSafeEqual } from "node:crypto";
import { seasonEndDate } from "@/lib/dates";
import { expireFullSeasonPlans } from "@/lib/db/subscriptions";
import { requireEnv } from "@/lib/env";
import { startStormDay } from "@/lib/storms";
import { getSnowForecast, snowThresholdMm } from "@/lib/weather";

// Called once a day by the Cloudflare cron trigger (see wrangler.jsonc and
// custom-worker.ts). Ends finished Full Season plans, then starts a storm day
// for tomorrow when enough snow is forecast. Requires `Authorization: Bearer
// <CRON_SECRET>`, which custom-worker.ts sends.
export async function GET(request: Request) {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${requireEnv("CRON_SECRET")}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const seasonEnd = seasonEndDate();
  const expiredSeasonPlans = seasonEnd ? await expireFullSeasonPlans(seasonEnd) : 0;

  const forecast = await getSnowForecast();
  const threshold = snowThresholdMm();
  if (forecast.expectedSnowMm < threshold) {
    return Response.json({ stormDay: false, threshold, expiredSeasonPlans, ...forecast });
  }

  const result = await startStormDay({
    serviceDate: forecast.serviceDate,
    expectedSnowMm: forecast.expectedSnowMm,
    source: "forecast",
  });
  return Response.json({ stormDay: true, threshold, expiredSeasonPlans, ...forecast, ...result });
}
