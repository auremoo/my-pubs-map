import {
  getVisitedBars,
  addVisitedBar,
  removeVisitedBar,
  updateVisitedNotes,
  getCustomBars,
  addCustomBarLocal,
  getSettings as getStoredSettings,
  saveSettings as saveStoredSettings,
  getExportData,
  type VisitedBarData,
  type AppSettings,
} from "./storage";

export interface Bar {
  osm_id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface VisitedBar extends Bar {
  id: number;
  visited_at: string;
  notes: string | null;
}

export interface Settings {
  data_source: string;
  foursquare_api_key: string;
}

export interface GeocodingResult {
  display_name: string;
  lat: number;
  lon: number;
}

// ── Overpass API (direct, CORS-friendly) ──

async function fetchBarsOverpass(lat: number, lon: number, radiusKm: number): Promise<Bar[]> {
  const latOffset = radiusKm / 111.32;
  const lonOffset = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const bbox = `${lat - latOffset},${lon - lonOffset},${lat + latOffset},${lon + lonOffset}`;
  const query = `[out:json][timeout:60];(node["amenity"~"^(bar|pub|nightclub|biergarten)$"](${bbox});way["amenity"~"^(bar|pub|nightclub|biergarten)$"](${bbox}););out center body;`;

  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) throw new Error(`Overpass API error: ${response.status}`);
  const data = await response.json();

  return data.elements
    .map((el: { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: { name?: string } }) => ({
      osm_id: `${el.type}/${el.id}`,
      name: el.tags?.name || "Bar sans nom",
      lat: el.lat ?? el.center?.lat,
      lon: el.lon ?? el.center?.lon,
    }))
    .filter((b: Bar) => b.lat != null && b.lon != null);
}

// ── Foursquare API (direct from browser) ──

const FSQ_QUERIES = ["bar", "pub", "nightclub", "cocktail"];
const FSQ_MAX_RADIUS = 5000;

async function fetchBarsFoursquare(lat: number, lon: number, radiusKm: number, apiKey: string): Promise<Bar[]> {
  const radiusM = Math.min(radiusKm * 1000, FSQ_MAX_RADIUS);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
    "X-Places-Api-Version": "2025-06-17",
  };

  const seen = new Set<string>();
  const allBars: Bar[] = [];

  const promises = FSQ_QUERIES.map(async (query) => {
    const url = new URL("https://places-api.foursquare.com/places/search");
    url.searchParams.set("ll", `${lat},${lon}`);
    url.searchParams.set("radius", String(radiusM));
    url.searchParams.set("query", query);
    url.searchParams.set("limit", "50");

    const response = await fetch(url.toString(), { headers });
    if (!response.ok) {
      if (query === FSQ_QUERIES[0]) {
        throw new Error(`Foursquare API error: ${response.status}`);
      }
      return [];
    }
    const data = await response.json();
    return data.results as { fsq_place_id: string; name: string; latitude: number; longitude: number }[];
  });

  const results = await Promise.all(promises);
  for (const places of results) {
    for (const place of places) {
      if (place.latitude == null || place.longitude == null) continue;
      const id = `fsq/${place.fsq_place_id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      allBars.push({ osm_id: id, name: place.name, lat: place.latitude, lon: place.longitude });
    }
  }

  return allBars;
}

// ── Haversine ──

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Public API (same interface as before, backed by localStorage) ──

export async function fetchNearbyBars(lat: number, lon: number, radius: number): Promise<Bar[]> {
  const settings = getStoredSettings();
  let bars: Bar[];

  if (settings.data_source === "foursquare") {
    if (!settings.foursquare_api_key) throw new Error("Foursquare API key not configured");
    bars = await fetchBarsFoursquare(lat, lon, radius, settings.foursquare_api_key);
  } else {
    bars = await fetchBarsOverpass(lat, lon, radius);

    // Merge custom bars within radius
    const customs = getCustomBars();
    for (const cb of customs) {
      if (haversineKm(lat, lon, cb.lat, cb.lon) <= radius) {
        bars.push({ osm_id: `custom/${cb.id}`, name: cb.name, lat: cb.lat, lon: cb.lon });
      }
    }
  }

  return bars;
}

export async function fetchVisitedBars(): Promise<VisitedBar[]> {
  return getVisitedBars().map((v: VisitedBarData, i: number) => ({ ...v, id: i + 1 }));
}

export async function markVisited(bar: Bar): Promise<void> {
  addVisitedBar(bar);
}

export async function unmarkVisited(osm_id: string): Promise<void> {
  removeVisitedBar(osm_id);
}

export async function addCustomBar(name: string, lat: number, lon: number): Promise<{ id: number; osm_id: string }> {
  return addCustomBarLocal(name, lat, lon);
}

export async function fetchSettings(): Promise<Settings> {
  return getStoredSettings();
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  saveStoredSettings(settings);
}

export async function updateNotes(osm_id: string, notes: string): Promise<void> {
  updateVisitedNotes(osm_id, notes);
}

export async function searchAddress(query: string): Promise<GeocodingResult[]> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
    { headers: { "User-Agent": "MyPubsMap/1.0" } }
  );
  if (!res.ok) throw new Error("Geocoding failed");
  const data = await res.json();
  return data.map((r: { display_name: string; lat: string; lon: string }) => ({
    display_name: r.display_name,
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
  }));
}

export function getExportDataLocal() {
  return getExportData();
}
