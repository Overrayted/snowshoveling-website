import "server-only";
import { getAdminClient, isNotFound } from "@/lib/pocketbase/client";
import type { DrivewaySize } from "@/lib/pocketbase/types";

export type DrivewayEstimate =
  | { status: "ok"; size: DrivewaySize; squareFeet: number; formattedAddress: string }
  // The address couldn't be pinned to a specific house
  | { status: "not_found" }
  // API keys missing or an upstream error: carry on without an estimate
  | { status: "unavailable" };

const MAP_ZOOM = 20;
const MAP_SIZE_PX = 640;

// Never throws. The estimate is a nice-to-have, so failures degrade to
// "unavailable" and the customer can still pick a plan and sign up. It also
// works while PocketBase is down, just without the cache.
export async function estimateDriveway(address: string): Promise<DrivewayEstimate> {
  if (!process.env.GOOGLE_MAPS_API_KEY || !process.env.GEMINI_API_KEY) {
    return { status: "unavailable" };
  }
  const key = address.trim().toLowerCase().replace(/\s+/g, " ");

  const cached = await readCachedEstimate(key).catch((error) => {
    console.error("Estimate cache read failed", error);
    return null;
  });
  if (cached) return cached;

  let estimate: DrivewayEstimate;
  try {
    estimate = await computeEstimate(key);
  } catch (error) {
    console.error("Driveway estimate failed", error);
    return { status: "unavailable" };
  }
  await saveCachedEstimate(key, estimate).catch((error) =>
    console.error("Estimate cache write failed", error),
  );
  return estimate;
}

// Cached per address (driveways don't change), so the quote page and the
// signup share one Gemini call. Failed estimates aren't cached, to allow a
// retry. Delete rows in the driveway_estimates collection to force a redo.
async function readCachedEstimate(key: string): Promise<DrivewayEstimate | null> {
  const pb = await getAdminClient();
  try {
    const row = await pb
      .collection("driveway_estimates")
      .getFirstListItem(pb.filter("address_key = {:key}", { key }));
    if (row.status === "not_found" || !row.size) return { status: "not_found" };
    return {
      status: "ok",
      size: row.size,
      squareFeet: row.square_feet,
      formattedAddress: row.formatted_address,
    };
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

async function saveCachedEstimate(key: string, estimate: DrivewayEstimate) {
  if (estimate.status === "unavailable") return;
  const pb = await getAdminClient();
  await pb.collection("driveway_estimates").create({
    address_key: key,
    status: estimate.status,
    size: estimate.status === "ok" ? estimate.size : "",
    square_feet: estimate.status === "ok" ? estimate.squareFeet : 0,
    formatted_address: estimate.status === "ok" ? estimate.formattedAddress : "",
  });
}

async function computeEstimate(address: string): Promise<DrivewayEstimate> {
  const place = await geocode(address);
  if (!place) return { status: "not_found" };

  const image = await fetchSatelliteImage(place.lat, place.lng);
  const result = await classifyDriveway(image, metersPerPixel(place.lat));
  if (!result.driveway_visible) return { status: "not_found" };

  return {
    status: "ok",
    size: result.size_category,
    squareFeet: Math.round(result.estimated_square_feet),
    formattedAddress: place.formattedAddress,
  };
}

async function geocode(address: string) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("region", "ca");
  url.searchParams.set("key", process.env.GOOGLE_MAPS_API_KEY!);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`);
  const body = await res.json();
  if (body.status === "ZERO_RESULTS") return null;
  if (body.status !== "OK") throw new Error(`Geocoding ${body.status}: ${body.error_message ?? ""}`);

  // Only accept results that point at a specific building, not a street or city
  const result = body.results[0];
  const types: string[] = result.types ?? [];
  if (!types.some((t) => ["street_address", "premise", "subpremise"].includes(t))) {
    return null;
  }
  return {
    lat: result.geometry.location.lat as number,
    lng: result.geometry.location.lng as number,
    formattedAddress: result.formatted_address as string,
  };
}

// Ground distance covered by one pixel of a Web Mercator map tile.
function metersPerPixel(lat: number) {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** MAP_ZOOM;
}

async function fetchSatelliteImage(lat: number, lng: number) {
  const url = new URL("https://maps.googleapis.com/maps/api/staticmap");
  url.searchParams.set("center", `${lat},${lng}`);
  url.searchParams.set("zoom", String(MAP_ZOOM));
  url.searchParams.set("size", `${MAP_SIZE_PX}x${MAP_SIZE_PX}`);
  url.searchParams.set("maptype", "satellite");
  url.searchParams.set("key", process.env.GOOGLE_MAPS_API_KEY!);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Static Maps HTTP ${res.status}`);
  return {
    mimeType: res.headers.get("content-type") ?? "image/png",
    data: Buffer.from(await res.arrayBuffer()).toString("base64"),
  };
}

type GeminiDrivewayResult = {
  driveway_visible: boolean;
  size_category: DrivewaySize;
  estimated_square_feet: number;
};

async function classifyDriveway(
  image: { mimeType: string; data: string },
  mPerPx: number,
): Promise<GeminiDrivewayResult> {
  const widthFeet = Math.round(mPerPx * MAP_SIZE_PX * 3.28084);
  const prompt = `This is a top-down satellite image of a residential property. The house
the customer gave us is at the exact centre of the image. The image covers
about ${widthFeet} x ${widthFeet} feet (${(mPerPx * 3.28084).toFixed(2)} feet per pixel).

Find the driveway that belongs to the house at the centre (not a neighbour's)
and estimate the paved area a snow shoveller would need to clear, including
any front walkway connected to it.

Size categories:
- small: under 400 sq ft (e.g. a short single-car driveway)
- medium: 400 to 800 sq ft (e.g. a long single or a standard double driveway)
- large: over 800 sq ft (e.g. a wide, long or circular driveway)

If you can't identify a driveway for the centre house (trees, snow cover,
apartment building, poor image), set driveway_visible to false.`;

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY!,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }, { inlineData: image }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              driveway_visible: { type: "BOOLEAN" },
              size_category: { type: "STRING", enum: ["small", "medium", "large"] },
              estimated_square_feet: { type: "INTEGER" },
            },
            required: ["driveway_visible", "size_category", "estimated_square_feet"],
          },
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${await res.text()}`);

  const body = await res.json();
  const text = (body.candidates?.[0]?.content?.parts ?? [])
    .filter((p: { thought?: boolean }) => !p.thought)
    .map((p: { text?: string }) => p.text ?? "")
    .join("");
  const result = JSON.parse(text) as GeminiDrivewayResult;

  if (!["small", "medium", "large"].includes(result.size_category)) {
    throw new Error(`Gemini returned unexpected size: ${result.size_category}`);
  }
  return result;
}
