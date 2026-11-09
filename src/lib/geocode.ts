// Find places by name as you type, with Photon: an OpenStreetMap search
// made for type-ahead (photon.komoot.io; free, fair use, no guarantee).
// Nominatim, OSM's main search, doesn't allow type-ahead use.

export const PHOTON = 'https://photon.komoot.io/api/';

export interface FoundPlace {
  /** what to show: "Brooklyn · New York, United States" */
  label: string;
  name: string;
  latitude: number;
  longitude: number;
  /** [west, north, east, south], for places with an area */
  extent?: [number, number, number, number];
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    extent?: [number, number, number, number];
  };
}

/** A place's name, then the bigger places it's in (no repeats). */
export function placeLabel(p: PhotonFeature['properties']): { name: string; label: string } {
  const name = p.name ?? [p.housenumber, p.street].filter(Boolean).join(' ') ?? '';
  const around: string[] = [];
  for (const x of [p.city, p.state, p.country]) {
    if (x && x !== name && !around.includes(x)) around.push(x);
  }
  return { name, label: around.length ? `${name} · ${around.join(', ')}` : name };
}

export async function searchPlaces(
  q: string,
  opts: { near?: { latitude: number; longitude: number }; limit?: number; signal?: AbortSignal } = {},
): Promise<FoundPlace[]> {
  const url = new URL(PHOTON);
  url.searchParams.set('q', q);
  url.searchParams.set('limit', String(opts.limit ?? 6));
  url.searchParams.set('lang', 'en');
  if (opts.near) {
    // prefer places near where the map is looking
    url.searchParams.set('lat', opts.near.latitude.toFixed(3));
    url.searchParams.set('lon', opts.near.longitude.toFixed(3));
  }
  const res = await fetch(url, { signal: opts.signal });
  if (!res.ok) throw new Error(String(res.status));
  const data = (await res.json()) as { features: PhotonFeature[] };
  const seen = new Set<string>();
  const out: FoundPlace[] = [];
  for (const f of data.features) {
    const { name, label } = placeLabel(f.properties);
    if (!name || seen.has(label)) continue;
    seen.add(label);
    const [longitude, latitude] = f.geometry.coordinates;
    out.push({ label, name, latitude, longitude, extent: f.properties.extent });
  }
  return out;
}
