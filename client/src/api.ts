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

const API_BASE = "/api/bars";

export async function fetchNearbyBars(
  lat: number,
  lon: number,
  radius: number
): Promise<Bar[]> {
  const res = await fetch(
    `${API_BASE}/nearby?lat=${lat}&lon=${lon}&radius=${radius}`
  );
  if (!res.ok) throw new Error("Failed to fetch nearby bars");
  return res.json();
}

export async function fetchVisitedBars(): Promise<VisitedBar[]> {
  const res = await fetch(`${API_BASE}/visited`);
  if (!res.ok) throw new Error("Failed to fetch visited bars");
  return res.json();
}

export async function markVisited(bar: Bar): Promise<void> {
  const res = await fetch(`${API_BASE}/visited`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bar),
  });
  if (!res.ok) throw new Error("Failed to mark bar as visited");
}

export async function unmarkVisited(osm_id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/visited/${osm_id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to unmark bar");
}

export async function addCustomBar(
  name: string,
  lat: number,
  lon: number
): Promise<{ id: number; osm_id: string }> {
  const res = await fetch(`${API_BASE}/custom`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, lat, lon }),
  });
  if (!res.ok) throw new Error("Failed to add custom bar");
  return res.json();
}

export async function fetchSettings(): Promise<Settings> {
  const res = await fetch(`${API_BASE}/settings`);
  if (!res.ok) throw new Error("Failed to fetch settings");
  return res.json();
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const res = await fetch(`${API_BASE}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error("Failed to save settings");
}
