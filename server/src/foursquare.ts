import type { OsmBar } from "./overpass";

export async function fetchBarsFromFoursquare(
  lat: number,
  lon: number,
  radiusKm: number,
  apiKey: string
): Promise<OsmBar[]> {
  const radiusM = Math.min(radiusKm * 1000, 50000);
  const url = new URL("https://api.foursquare.com/v3/places/search");
  url.searchParams.set("ll", `${lat},${lon}`);
  url.searchParams.set("radius", String(radiusM));
  url.searchParams.set("categories", "13003,13017,13014,13029");
  // 13003 = Bar, 13017 = Nightclub, 13014 = Lounge, 13029 = Pub
  url.searchParams.set("limit", "50");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: apiKey,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Foursquare API error: ${response.status}`);
  }

  const data = await response.json();

  return data.results.map((place: any) => ({
    osm_id: `fsq/${place.fsq_id}`,
    name: place.name,
    lat: place.geocodes?.main?.latitude,
    lon: place.geocodes?.main?.longitude,
  })).filter((b: OsmBar) => b.lat != null && b.lon != null);
}
