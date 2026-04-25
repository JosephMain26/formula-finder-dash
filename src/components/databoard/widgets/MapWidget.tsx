import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { geocodeAddress, getCached } from "@/lib/databoard/geocode";
import type { Tables } from "@/integrations/supabase/types";

type Job = Tables<"jobs">;

// Fix default marker icons (Leaflet's default uses webpack URLs that break in Vite)
const icon = new L.Icon({
  iconUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface Props {
  jobs: Job[];
  onOpenJob?: (job: Job) => void;
}

type Pin = { job: Job; lat: number; lng: number };

function FitBounds({ pins }: { pins: Pin[] }) {
  const map = useMap();
  useEffect(() => {
    if (!pins.length) return;
    const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [20, 20], maxZoom: 13 });
  }, [pins, map]);
  return null;
}

export function MapWidget({ jobs, onOpenJob }: Props) {
  const [pins, setPins] = useState<Pin[]>([]);
  const [pending, setPending] = useState(0);
  const cancelRef = useRef(false);

  const candidates = useMemo(() => jobs.filter((j) => (j.address || "").trim().length > 4), [jobs]);

  useEffect(() => {
    cancelRef.current = false;
    // start with cached pins immediately
    const initial: Pin[] = [];
    const toFetch: Job[] = [];
    for (const j of candidates) {
      const c = getCached(j.address!);
      if (c) initial.push({ job: j, lat: c.lat, lng: c.lng });
      else toFetch.push(j);
    }
    setPins(initial);
    setPending(toFetch.length);

    (async () => {
      for (const j of toFetch) {
        if (cancelRef.current) return;
        const r = await geocodeAddress(j.address!);
        if (cancelRef.current) return;
        setPending((n) => Math.max(0, n - 1));
        if (r) setPins((prev) => [...prev, { job: j, lat: r.lat, lng: r.lng }]);
      }
    })();

    return () => { cancelRef.current = true; };
  }, [candidates]);

  const center: [number, number] = pins.length ? [pins[0].lat, pins[0].lng] : [39.5, -98.35]; // US center

  return (
    <div
      className="h-full w-full relative"
      onMouseDownCapture={(e) => e.stopPropagation()}
      onTouchStartCapture={(e) => e.stopPropagation()}
      onPointerDownCapture={(e) => e.stopPropagation()}
    >
      {pending > 0 && (
        <div className="absolute top-2 right-2 z-[1000] text-xs bg-background/90 border rounded px-2 py-1 shadow">
          Geocoding… {pending} left
        </div>
      )}
      {!candidates.length ? (
        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No addresses</div>
      ) : (
        <MapContainer center={center} zoom={4} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {pins.map((p, i) => (
            <Marker key={p.job.id + i} position={[p.lat, p.lng]} icon={icon}>
              <Popup>
                <div className="space-y-1 text-sm min-w-[180px]">
                  <div className="font-semibold">{p.job.tech_name || "—"} · {p.job.job_type || "—"}</div>
                  <div className="text-xs text-muted-foreground">{p.job.company || "—"}</div>
                  <div className="text-xs">{p.job.address}</div>
                  <div className="flex justify-between text-xs">
                    <span>{p.job.job_date}</span>
                    <span className="font-semibold">${Number(p.job.price || 0).toFixed(0)}</span>
                  </div>
                  <Button size="sm" className="w-full mt-1" onClick={() => onOpenJob?.(p.job)}>Open ticket</Button>
                </div>
              </Popup>
            </Marker>
          ))}
          <FitBounds pins={pins} />
        </MapContainer>
      )}
    </div>
  );
}
