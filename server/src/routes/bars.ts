import { Router, Request, Response } from "express";
import db from "../db";
import { fetchBarsAround } from "../overpass";
import { fetchBarsFromFoursquare } from "../foursquare";
import type { OsmBar } from "../overpass";

const router = Router();

function getSetting(key: string): string {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value || "";
}

// Get bars around a location
router.get("/nearby", async (req: Request, res: Response) => {
  const lat = parseFloat(req.query.lat as string);
  const lon = parseFloat(req.query.lon as string);
  const radius = parseFloat(req.query.radius as string) || 2;

  if (isNaN(lat) || isNaN(lon)) {
    res.status(400).json({ error: "lat and lon are required" });
    return;
  }

  if (radius < 1 || radius > 10) {
    res.status(400).json({ error: "radius must be between 1 and 10 km" });
    return;
  }

  try {
    const source = getSetting("data_source");
    let bars: OsmBar[];

    if (source === "foursquare") {
      const apiKey = getSetting("foursquare_api_key");
      if (!apiKey) {
        res.status(400).json({ error: "Foursquare API key not configured" });
        return;
      }
      bars = await fetchBarsFromFoursquare(lat, lon, radius, apiKey);
    } else {
      bars = await fetchBarsAround(lat, lon, radius);

      // Merge custom bars within radius
      const customBars = db
        .prepare("SELECT * FROM custom_bars")
        .all() as { id: number; name: string; lat: number; lon: number }[];

      for (const cb of customBars) {
        const dist = haversineKm(lat, lon, cb.lat, cb.lon);
        if (dist <= radius) {
          bars.push({
            osm_id: `custom/${cb.id}`,
            name: cb.name,
            lat: cb.lat,
            lon: cb.lon,
          });
        }
      }
    }

    res.json(bars);
  } catch (err) {
    console.error("Fetch bars error:", err);
    res.status(502).json({ error: "Failed to fetch bars" });
  }
});

// Get all visited bars
router.get("/visited", (_req: Request, res: Response) => {
  const rows = db.prepare("SELECT * FROM visited_bars ORDER BY visited_at DESC").all();
  res.json(rows);
});

// Mark a bar as visited
router.post("/visited", (req: Request, res: Response) => {
  const { osm_id, name, lat, lon, notes } = req.body;

  if (!osm_id || !name || lat == null || lon == null) {
    res.status(400).json({ error: "osm_id, name, lat, lon are required" });
    return;
  }

  try {
    const stmt = db.prepare(
      `INSERT INTO visited_bars (osm_id, name, lat, lon, notes)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(osm_id) DO UPDATE SET notes = excluded.notes`
    );
    stmt.run(osm_id, name, lat, lon, notes || null);
    res.json({ success: true });
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).json({ error: "Failed to save visited bar" });
  }
});

// Update notes on a visited bar
router.put("/visited/:osm_id/notes", (req: Request, res: Response) => {
  const { osm_id } = req.params;
  const { notes } = req.body;
  db.prepare("UPDATE visited_bars SET notes = ? WHERE osm_id = ?").run(notes || null, osm_id);
  res.json({ success: true });
});

// Remove a bar from visited
router.delete("/visited/:osm_id", (req: Request, res: Response) => {
  const { osm_id } = req.params;
  db.prepare("DELETE FROM visited_bars WHERE osm_id = ?").run(osm_id);
  res.json({ success: true });
});

// ── Custom bars ─────────────────────────────

router.post("/custom", (req: Request, res: Response) => {
  const { name, lat, lon } = req.body;
  if (!name || lat == null || lon == null) {
    res.status(400).json({ error: "name, lat, lon are required" });
    return;
  }
  const result = db
    .prepare("INSERT INTO custom_bars (name, lat, lon) VALUES (?, ?, ?)")
    .run(name, lat, lon);
  res.json({ id: result.lastInsertRowid, osm_id: `custom/${result.lastInsertRowid}` });
});

router.delete("/custom/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  db.prepare("DELETE FROM custom_bars WHERE id = ?").run(id);
  db.prepare("DELETE FROM visited_bars WHERE osm_id = ?").run(`custom/${id}`);
  res.json({ success: true });
});

// ── Settings ────────────────────────────────

router.get("/settings", (_req: Request, res: Response) => {
  const rows = db.prepare("SELECT key, value FROM settings").all() as {
    key: string;
    value: string;
  }[];
  const settings: Record<string, string> = {};
  for (const row of rows) settings[row.key] = row.value;
  res.json(settings);
});

router.put("/settings", (req: Request, res: Response) => {
  const entries = req.body as Record<string, string>;
  const stmt = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  for (const [key, value] of Object.entries(entries)) {
    stmt.run(key, value);
  }
  res.json({ success: true });
});

// ── Export ──────────────────────────────

router.get("/export", (_req: Request, res: Response) => {
  const visited = db
    .prepare("SELECT osm_id, name, lat, lon, visited_at, notes FROM visited_bars ORDER BY name")
    .all() as { osm_id: string; name: string; lat: number; lon: number; visited_at: string; notes: string | null }[];

  const custom = db
    .prepare("SELECT id, name, lat, lon, created_at FROM custom_bars ORDER BY name")
    .all() as { id: number; name: string; lat: number; lon: number; created_at: string }[];

  res.json({ visited, custom, exported_at: new Date().toISOString() });
});

// ── Helpers ─────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default router;
