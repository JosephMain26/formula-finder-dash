# Fix: address validator + map pins

## Root cause

Geocoding in `src/lib/databoard/geocode.ts` calls `https://nominatim.openstreetmap.org` directly from the browser. That endpoint is unreliable here: it rate-limits aggressively (Nominatim's policy is 1 req/sec and they actively block apps that hit it from many users), and browser calls hit CORS / 403s with no retry. When it fails:

- `validateAddressForSave` falls back to `unresolved` → the user sees the "we couldn't verify this address" dialog instead of a clean save.
- `MapWidget` gets `null` for every address → no pins.

The project already has the Google Maps Platform connector available, and the knowledge says to use it for geocoding. We just never wired it up.

## What I'll change

1. **New server function** `src/lib/geocode.functions.ts`
   - `geocodeAddressServer({ address })` — calls the Google Maps gateway
     (`/maps/api/geocode/json`) using `LOVABLE_API_KEY` + `GOOGLE_MAPS_API_KEY`
     env vars injected by the connector. Returns `{ lat, lng, displayName } | null`.
   - Keeps response shape identical to the current `geocodeAddressDetailed`.

2. **Rewrite `src/lib/databoard/geocode.ts`**
   - Drop the direct Nominatim `fetch`. Keep the localStorage cache, the
     `getCached` helper, the `normalizeAddressInput` helper, and the
     `geocodeAddress` / `geocodeAddressDetailed` exports (so callers in
     `MapWidget`, `addressValidation.ts`, `AddJobDialog`, and `upload.tsx`
     don't change).
   - Internally, `geocodeAddressDetailed` now calls the server fn via
     `useServerFn`-equivalent direct import (server fns can be called from
     client modules — `await geocodeAddressServer({ data: { address } })`).
   - Cache hits/misses stay in localStorage exactly as today (positive +
     negative TTL), so we don't re-hit Google for already-resolved addresses.
   - Remove the 1.1s throttle since Google's quota is far higher; keep a
     small in-flight de-dupe map so simultaneous calls for the same address
     share one request.

3. **Connector check**
   - If the Google Maps connector isn't connected yet, the server fn returns
     a clear error and I'll prompt to connect it via `standard_connectors--connect`
     before running. (I'll check `list_connections` first when implementing.)

## Out of scope

- No UI changes. `AddressReviewDialog`, `AddJobDialog`, `upload.tsx`,
  `MapWidget` keep their current behavior — they just start getting real
  results back.
- No DB changes.
- I'm not switching the map tiles to Google Maps; OSM tiles in `MapWidget`
  stay. Only the geocoder changes.

## Technical notes

- Server fn uses the gateway pattern from the Google Maps connector docs:
  `fetch('https://connector-gateway.lovable.dev/google_maps/maps/api/geocode/json?address=…', { headers: { Authorization: Bearer ${LOVABLE_API_KEY}, 'X-Connection-Api-Key': ${GOOGLE_MAPS_API_KEY} } })`.
- Env vars are read inside `.handler()`, not at module scope.
- `attachSupabaseAuth` middleware is not needed — geocoding is not user-scoped.
