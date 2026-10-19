import { timingSafeEqual } from "node:crypto";
import { requireEnv } from "@/lib/env";
import { startStormDay } from "@/lib/storms";
import { getSnowForecast, snowThresholdMm } from "@/lib/weather";

// Called once a day by the scheduler (see vercel.json). Starts a storm day for
// tomorrow when enough snow is forecast. Requires `Authorization: Bearer
// <CRON_SECRET>`, which Vercel Cron sends automatically.
export async function GET(request: Request) {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${requireEnv("CRON_SECRET")}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const forecast = await getSnowForecast();
  const threshold = snowThresholdMm();
  if (forecast.expectedSnowMm < threshold) {
    return Response.json({ stormDay: false, threshold, ...forecast });
  }

  const result = await startStormDay({
    serviceDate: forecast.serviceDate,
    expectedSnowMm: forecast.expectedSnowMm,
    source: "forecast",
  });
  return Response.json({ stormDay: true, threshold, ...forecast, ...result });
}
