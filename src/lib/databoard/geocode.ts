// Free geocoding via Nominatim (OpenStreetMap). Cached in localStorage.
// Throttled to 1 req/sec per Nominatim policy.

const CACHE_KEY = "geocode_cache_v1";
const NEG_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days for "not found"

type LatLng = { lat: number; lng: number };
type CacheEntry = { lat?: number; lng?: number; t: number };

function readCache(): Record<string, CacheEntry> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch { return {}; }
}
function writeCache(c: Record<string, CacheEntry>) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch {}
}

let queue: Promise<any> = Promise.resolve();
function throttle<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(() => fn().finally(() => new Promise((r) => setTimeout(r, 1100))));
  queue = next.catch(() => {});
  return next as Promise<T>;
}

export function getCached(address: string): LatLng | null {
  const c = readCache();
  const e = c[address.trim().toLowerCase()];
  if (!e) return null;
  if (e.lat == null || e.lng == null) {
    if (Date.now() - e.t > NEG_TTL_MS) return null;
    return null;
  }
  return { lat: e.lat, lng: e.lng };
}

export async function geocodeAddress(address: string): Promise<LatLng | null> {
  const key = address.trim().toLowerCase();
  if (!key) return null;
  const cached = getCached(address);
  if (cached) return cached;
  const c = readCache();
  if (c[key] && Date.now() - c[key].t < NEG_TTL_MS && c[key].lat == null) return null;

  return throttle(async () => {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(String(res.status));
      const arr = await res.json();
      const c2 = readCache();
      if (Array.isArray(arr) && arr[0]?.lat && arr[0]?.lon) {
        const lat = parseFloat(arr[0].lat);
        const lng = parseFloat(arr[0].lon);
        c2[key] = { lat, lng, t: Date.now() };
        writeCache(c2);
        return { lat, lng };
      }
      c2[key] = { t: Date.now() };
      writeCache(c2);
      return null;
    } catch {
      return null;
    }
  });
}
