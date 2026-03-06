export interface OsmBar {
  osm_id: string;
  name: string;
  lat: number;
  lon: number;
}

export async function fetchBarsAround(
  lat: number,
  lon: number,
  radiusKm: number
): Promise<OsmBar[]> {
  const radiusM = radiusKm * 1000;

  // Use bounding box instead of around for better performance on large radii
  const latOffset = radiusKm / 111.32;
  const lonOffset = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const south = lat - latOffset;
  const north = lat + latOffset;
  const west = lon - lonOffset;
  const east = lon + lonOffset;

  // Search nodes AND ways (buildings), for bar/pub/nightclub/biergarten
  const bbox = `${south},${west},${north},${east}`;
  const query = `[out:json][timeout:60];(node["amenity"~"^(bar|pub|nightclub|biergarten)$"](${bbox});way["amenity"~"^(bar|pub|nightclub|biergarten)$"](${bbox}););out center body;`;

  const response = await fetch(
    "https://overpass-api.de/api/interpreter",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    }
  );

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status}`);
  }

  const data = await response.json();

  return data.elements
    .map((el: any) => ({
      osm_id: `${el.type}/${el.id}`,
      name: el.tags?.name || "Bar sans nom",
      lat: el.lat ?? el.center?.lat,
      lon: el.lon ?? el.center?.lon,
    }))
    .filter((b: OsmBar) => b.lat != null && b.lon != null);
}
