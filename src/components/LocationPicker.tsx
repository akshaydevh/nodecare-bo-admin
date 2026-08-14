import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { divIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Input } from './ui';

const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 };
const pinIcon = divIcon({
  className: 'nod-map-pin',
  html: '<span class="nod-map-pin-dot"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

type SearchHit = { label: string; lat: number; lng: number };

function parseCoord(value: string, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatCoord(n: number) {
  return n.toFixed(6);
}

function ResizeMap() {
  const map = useMap();
  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize(), 80);
    return () => window.clearTimeout(id);
  }, [map]);
  return null;
}

function ClickToSet({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function FlyTo({ lat, lng, nonce }: { lat: number; lng: number; nonce: number }) {
  const map = useMap();
  useEffect(() => {
    if (!nonce) return;
    map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [lat, lng, map, nonce]);
  return null;
}

export function LocationPicker({
  lat,
  lng,
  onChange,
}: {
  lat: string;
  lng: string;
  onChange: (lat: string, lng: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [flyNonce, setFlyNonce] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const hasPoint = lat !== '' && lng !== '' && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
  const position = useMemo(
    () => ({
      lat: parseCoord(lat, DEFAULT_CENTER.lat),
      lng: parseCoord(lng, DEFAULT_CENTER.lng),
    }),
    [lat, lng],
  );

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setHits([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setSearching(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=0&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) return;
        const rows = (await res.json()) as { display_name: string; lat: string; lon: string }[];
        setHits(
          rows.map((row) => ({
            label: row.display_name,
            lat: Number(row.lat),
            lng: Number(row.lon),
          })),
        );
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setHits([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [query]);

  function pick(nextLat: number, nextLng: number, fly = false) {
    onChange(formatCoord(nextLat), formatCoord(nextLng));
    if (fly) setFlyNonce((n) => n + 1);
    setHits([]);
    setQuery('');
  }

  return (
    <div className="location-picker space-y-2">
      <div className="relative">
        <Input
          placeholder="Search an area, clinic, or city"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query.trim().length >= 3 ? (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-[var(--line)] bg-white shadow-lg max-h-40 overflow-y-auto">
            {searching ? (
              <div className="px-3 py-2 text-sm text-[var(--muted)]">Searching…</div>
            ) : hits.length === 0 ? (
              <div className="px-3 py-2 text-sm text-[var(--muted)]">No places found</div>
            ) : (
              hits.map((hit) => (
                <button
                  key={`${hit.lat}-${hit.lng}-${hit.label}`}
                  type="button"
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-[var(--brand-soft)]"
                  onClick={() => pick(hit.lat, hit.lng, true)}
                >
                  {hit.label}
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
      <MapContainer
        center={[position.lat, position.lng]}
        zoom={hasPoint ? 15 : 5}
        scrollWheelZoom
        className="h-60 w-full rounded-xl border border-[var(--line)]"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ResizeMap />
        <ClickToSet onPick={(nextLat, nextLng) => pick(nextLat, nextLng)} />
        <FlyTo lat={position.lat} lng={position.lng} nonce={flyNonce} />
        {hasPoint ? (
          <Marker
            draggable
            position={[position.lat, position.lng]}
            icon={pinIcon}
            eventHandlers={{
              dragend: (event) => {
                const marker = event.target as { getLatLng: () => { lat: number; lng: number } };
                const next = marker.getLatLng();
                pick(next.lat, next.lng);
              },
            }}
          />
        ) : null}
      </MapContainer>
      <p className="text-xs text-[var(--muted)]">
        Click the map or drag the pin to set the location
        {hasPoint ? ` · ${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}` : ''}
      </p>
    </div>
  );
}
