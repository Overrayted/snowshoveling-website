import "server-only";
import { requireEnv } from "@/lib/env";
import { addDays, localDate } from "@/lib/dates";

export type SnowForecast = {
  serviceDate: string; // the day we'd go out shovelling (tomorrow)
  expectedSnowMm: number;
};

// Totals forecast snow from now until the end of tomorrow (local time), so
// overnight snow counts toward tomorrow's visits.
//
// OpenWeatherMap reports snow as millimetres of precipitation per 3-hour
// block. Fresh snow is roughly 1 cm deep per 1 mm of precipitation, so treat
// the threshold as approximately centimetres on the ground.
export async function getSnowForecast(): Promise<SnowForecast> {
  const url = new URL("https://api.openweathermap.org/data/2.5/forecast");
  url.searchParams.set("lat", requireEnv("SERVICE_AREA_LAT"));
  url.searchParams.set("lon", requireEnv("SERVICE_AREA_LON"));
  url.searchParams.set("units", "metric");
  url.searchParams.set("appid", requireEnv("OPENWEATHER_API_KEY"));

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`OpenWeatherMap HTTP ${res.status}: ${await res.text()}`);
  const body: { list: { dt: number; snow?: { "3h"?: number } }[] } = await res.json();

  const serviceDate = addDays(localDate(), 1);
  const expectedSnowMm = body.list
    .filter((block) => localDate(new Date(block.dt * 1000)) <= serviceDate)
    .reduce((sum, block) => sum + (block.snow?.["3h"] ?? 0), 0);

  return { serviceDate, expectedSnowMm: Math.round(expectedSnowMm * 10) / 10 };
}

export function snowThresholdMm(): number {
  return Number(process.env.SNOW_ALERT_THRESHOLD_MM ?? 5);
}
