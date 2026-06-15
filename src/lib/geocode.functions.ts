import { createServerFn } from "@tanstack/react-start";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const CENSUS_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";

type GeoResult = { lat: number; lng: number; displayName: string };

async function geocodeViaGoogle(address: string): Promise<GeoResult | null> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
  // If the connector isn't configured, skip silently and let the fallback run.
  if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) return null;

  try {
    const url = `${GATEWAY_URL}/maps/api/geocode/json?address=${encodeURIComponent(address)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
      },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      status: string;
      results?: Array<{
        geometry?: { location?: { lat: number; lng: number } };
        formatted_address?: string;
      }>;
    };
    const hit = json.results?.[0];
    const loc = hit?.geometry?.location;
    // status can be REQUEST_DENIED / ZERO_RESULTS when the connector key lacks
    // Geocoding/billing — treat anything non-OK as "no result" and fall back.
    if (json.status !== "OK" || !loc) return null;
    return {
      lat: loc.lat,
      lng: loc.lng,
      displayName: hit?.formatted_address || address,
    };
  } catch {
    return null;
  }
}

// Progressively simplify an address so a free geocoder can still place a pin
// (e.g. strip unit/apartment, then drop the house number to city + state + zip).
function buildFallbackQueries(address: string): string[] {
  const cleaned = address
    .replace(/\b(?:apt|apartment|unit|ste|suite|fl|floor|bldg|building|#)\b\.?\s*[\w-]*/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/,+/g, ",")
    .trim();

  const noHouseNumber = cleaned.replace(/^\s*\d+[a-z]?\s+/i, "").trim();

  // OpenStreetMap often lacks exact house numbers for residential streets, so
  // progressively fall back to coarser locations (street → city/state/zip) so a
  // pin still lands in the right area instead of dropping the job entirely.
  const parts = cleaned.split(",").map((p) => p.trim()).filter(Boolean);
  const dropStreetLine = parts.length > 1 ? parts.slice(1).join(", ") : "";
  const lastTwo = parts.length > 2 ? parts.slice(-2).join(", ") : "";

  const queries = [address, cleaned, noHouseNumber, dropStreetLine, lastTwo].filter(Boolean);
  return Array.from(new Set(queries));
}

// US Census geocoder — free, no key, permits automated/bulk use, and resolves
// exact house numbers for US addresses. Best fallback for this app's US jobs.
async function geocodeViaCensus(address: string): Promise<GeoResult | null> {
  try {
    const url =
      `${CENSUS_URL}?address=${encodeURIComponent(address)}` +
      `&benchmark=Public_AR_Current&format=json`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      result?: {
        addressMatches?: Array<{
          matchedAddress?: string;
          coordinates?: { x: number; y: number };
        }>;
      };
    };
    const hit = json.result?.addressMatches?.[0];
    const coords = hit?.coordinates;
    if (coords && Number.isFinite(coords.x) && Number.isFinite(coords.y)) {
      return {
        lat: coords.y,
        lng: coords.x,
        displayName: hit?.matchedAddress || address,
      };
    }
  } catch {
    // fall through to next geocoder
  }
  return null;
}

async function geocodeViaNominatim(address: string): Promise<GeoResult | null> {
  for (const q of buildFallbackQueries(address)) {
    try {
      const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, {
        headers: {
          // Nominatim requires an identifying User-Agent.
          "User-Agent": "lovable-databoard/1.0 (map widget geocoding)",
          Accept: "application/json",
        },
      });
      if (!res.ok) continue;
      const arr = (await res.json()) as Array<{
        lat?: string;
        lon?: string;
        display_name?: string;
      }>;
      const hit = arr?.[0];
      if (hit?.lat && hit?.lon) {
        return {
          lat: Number(hit.lat),
          lng: Number(hit.lon),
          displayName: hit.display_name || address,
        };
      }
    } catch {
      // try next, less specific query
    }
  }
  return null;
}

export const geocodeAddressServer = createServerFn({ method: "POST" })
  .inputValidator((data: { address: string }) => {
    const address = String(data?.address ?? "").trim();
    if (!address) throw new Error("address required");
    if (address.length > 500) throw new Error("address too long");
    return { address };
  })
  .handler(async ({ data }): Promise<GeoResult | null> => {
    // Prefer Google (most accurate). When the Google connector key lacks
    // Geocoding/billing access, fall back to the free US Census geocoder
    // (exact US house numbers) and finally OpenStreetMap for anything else.
    const google = await geocodeViaGoogle(data.address);
    if (google) { console.log("[geocode] google", data.address); return google; }

    const census = await geocodeViaCensus(data.address);
    if (census) { console.log("[geocode] census", data.address, census); return census; }

    const osm = await geocodeViaNominatim(data.address);
    console.log("[geocode] osm/none", data.address, osm);
    return osm;
  });

