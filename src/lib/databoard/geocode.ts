// Geocoding via Google Maps connector gateway (server function). Cached in localStorage.

import { geocodeAddressServer } from "@/lib/geocode.functions";

const CACHE_KEY = "geocode_cache_v3"; // bumped: prior v2 cached stale "not found" results
const NEG_TTL_MS = 24 * 60 * 60 * 1000; // 1 day for "not found" (was 7d — recover faster)

type LatLng = { lat: number; lng: number };
type DetailedLatLng = LatLng & { displayName: string };
type CacheEntry = { lat?: number; lng?: number; t: number; displayName?: string };

export function normalizeAddressInput(address: string): string {
  return address
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/,+/g, ",")
    .replace(/^,+|,+$/g, "")
    .trim();
}

function readCache(): Record<string, CacheEntry> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch { return {}; }
}
function writeCache(c: Record<string, CacheEntry>) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch {}
}

export function getCached(address: string): LatLng | null {
  const c = readCache();
  const e = c[normalizeAddressInput(address).toLowerCase()];
  if (!e) return null;
  if (e.lat == null || e.lng == null) return null;
  return { lat: e.lat, lng: e.lng };
}

const inflight = new Map<string, Promise<DetailedLatLng | null>>();

export async function geocodeAddressDetailed(address: string): Promise<DetailedLatLng | null> {
  const normalized = normalizeAddressInput(address);
  const key = normalized.toLowerCase();
  if (!key) return null;

  const c = readCache();
  const e = c[key];
  if (e) {
    if (e.lat != null && e.lng != null) {
      return { lat: e.lat, lng: e.lng, displayName: e.displayName || normalized };
    }
    if (Date.now() - e.t < NEG_TTL_MS) return null;
  }

  const existing = inflight.get(key);
  if (existing) return existing;

  const p = (async (): Promise<DetailedLatLng | null> => {
    try {
      const res = await geocodeAddressServer({ data: { address: normalized } });
      const cur = readCache();
      if (res) {
        cur[key] = { lat: res.lat, lng: res.lng, displayName: res.displayName, t: Date.now() };
        writeCache(cur);
        return res;
      }
      cur[key] = { t: Date.now() };
      writeCache(cur);
      return null;
    } catch (err) {
      console.error("geocodeAddressDetailed failed", err);
      return null;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

export async function geocodeAddress(address: string): Promise<LatLng | null> {
  const detailed = await geocodeAddressDetailed(address);
  return detailed ? { lat: detailed.lat, lng: detailed.lng } : null;
}
