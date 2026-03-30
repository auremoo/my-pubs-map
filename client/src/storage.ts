// Client-side persistence using localStorage

export interface VisitedBarData {
  osm_id: string;
  name: string;
  lat: number;
  lon: number;
  visited_at: string;
  notes: string | null;
}

export interface CustomBarData {
  id: number;
  name: string;
  lat: number;
  lon: number;
  created_at: string;
}

export interface AppSettings {
  data_source: string;
  foursquare_api_key: string;
}

const KEYS = {
  visited: "pubs_visited",
  custom: "pubs_custom",
  settings: "pubs_settings",
  nextCustomId: "pubs_next_custom_id",
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ── Visited bars ────────────────────────

export function getVisitedBars(): VisitedBarData[] {
  return load<VisitedBarData[]>(KEYS.visited, []);
}

export function addVisitedBar(bar: { osm_id: string; name: string; lat: number; lon: number; notes?: string | null }) {
  const visited = getVisitedBars();
  const existing = visited.findIndex((v) => v.osm_id === bar.osm_id);
  if (existing >= 0) {
    visited[existing].notes = bar.notes ?? visited[existing].notes;
  } else {
    visited.push({
      osm_id: bar.osm_id,
      name: bar.name,
      lat: bar.lat,
      lon: bar.lon,
      visited_at: new Date().toISOString(),
      notes: bar.notes || null,
    });
  }
  save(KEYS.visited, visited);
}

export function removeVisitedBar(osm_id: string) {
  const visited = getVisitedBars().filter((v) => v.osm_id !== osm_id);
  save(KEYS.visited, visited);
}

export function updateVisitedNotes(osm_id: string, notes: string) {
  const visited = getVisitedBars();
  const bar = visited.find((v) => v.osm_id === osm_id);
  if (bar) {
    bar.notes = notes || null;
    save(KEYS.visited, visited);
  }
}

// ── Custom bars ─────────────────────────

export function getCustomBars(): CustomBarData[] {
  return load<CustomBarData[]>(KEYS.custom, []);
}

export function addCustomBarLocal(name: string, lat: number, lon: number): { id: number; osm_id: string } {
  const customs = getCustomBars();
  const nextId = load<number>(KEYS.nextCustomId, 1);
  customs.push({ id: nextId, name, lat, lon, created_at: new Date().toISOString() });
  save(KEYS.custom, customs);
  save(KEYS.nextCustomId, nextId + 1);
  return { id: nextId, osm_id: `custom/${nextId}` };
}

export function removeCustomBar(id: number) {
  const customs = getCustomBars().filter((c) => c.id !== id);
  save(KEYS.custom, customs);
  removeVisitedBar(`custom/${id}`);
}

// ── Settings ────────────────────────────

const DEFAULT_SETTINGS: AppSettings = {
  data_source: "overpass",
  foursquare_api_key: "",
};

export function getSettings(): AppSettings {
  return load<AppSettings>(KEYS.settings, DEFAULT_SETTINGS);
}

export function saveSettings(settings: Partial<AppSettings>) {
  const current = getSettings();
  save(KEYS.settings, { ...current, ...settings });
}

// ── Export data ─────────────────────────

export function getExportData() {
  return {
    visited: getVisitedBars(),
    custom: getCustomBars(),
    exported_at: new Date().toISOString(),
  };
}
