import { createServerFn } from "@tanstack/react-start";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

export const geocodeAddressServer = createServerFn({ method: "POST" })
  .inputValidator((data: { address: string }) => {
    const address = String(data?.address ?? "").trim();
    if (!address) throw new Error("address required");
    if (address.length > 500) throw new Error("address too long");
    return { address };
  })
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!GOOGLE_MAPS_API_KEY) throw new Error("GOOGLE_MAPS_API_KEY is not configured");

    const url = `${GATEWAY_URL}/maps/api/geocode/json?address=${encodeURIComponent(data.address)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Geocode failed [${res.status}]: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      status: string;
      results?: Array<{
        geometry?: { location?: { lat: number; lng: number } };
        formatted_address?: string;
      }>;
    };
    const hit = json.results?.[0];
    const loc = hit?.geometry?.location;
    if (json.status !== "OK" || !loc) return null;
    return {
      lat: loc.lat,
      lng: loc.lng,
      displayName: hit?.formatted_address || data.address,
    };
  });
