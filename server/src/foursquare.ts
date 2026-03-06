import type { OsmBar } from "./overpass";

const MAX_RADIUS_M = 5000; // 5km max for Foursquare
const PAGE_SIZE = 50;
// Multiple queries to get broader coverage since FSQ caps at 50 per query
const QUERIES = ["bar", "pub", "nightclub", "cocktail"];

interface FsqPlace {
  fsq_place_id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface FsqResponse {
  results: FsqPlace[];
}

export async function fetchBarsFromFoursquare(
  lat: number,
  lon: number,
  radiusKm: number,
  apiKey: string
): Promise<OsmBar[]> {
  const radiusM = Math.min(radiusKm * 1000, MAX_RADIUS_M);
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
    "X-Places-Api-Version": "2025-06-17",
  };

  const allBars: OsmBar[] = [];
  const seen = new Set<string>();

  // Run all queries in parallel for speed
  const promises = QUERIES.map(async (query) => {
    const url = new URL("https://places-api.foursquare.com/places/search");
    url.searchParams.set("ll", `${lat},${lon}`);
    url.searchParams.set("radius", String(radiusM));
    url.searchParams.set("query", query);
    url.searchParams.set("limit", String(PAGE_SIZE));

    const response = await fetch(url.toString(), { headers });
    if (!response.ok) {
      if (query === QUERIES[0]) {
        const body = await response.text();
        throw new Error(`Foursquare API error: ${response.status} - ${body}`);
      }
      return []; // Skip failed secondary queries
    }

    const data: FsqResponse = await response.json();
    return data.results;
  });

  const results = await Promise.all(promises);

  for (const places of results) {
    for (const place of places) {
      if (place.latitude == null || place.longitude == null) continue;
      const id = `fsq/${place.fsq_place_id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      allBars.push({
        osm_id: id,
        name: place.name,
        lat: place.latitude,
        lon: place.longitude,
      });
    }
  }

  return allBars;
}
