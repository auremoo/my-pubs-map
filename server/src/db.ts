import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Load .env file
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^(\w+)=(.*)$/);
    if (match) process.env[match[1]] = match[2].trim();
  }
}

const DB_PATH = path.join(__dirname, "..", "data", "pubs.db");

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS visited_bars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    osm_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    visited_at TEXT NOT NULL DEFAULT (datetime('now')),
    notes TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS custom_bars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

// Default settings
const upsertSetting = db.prepare(
  `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`
);
upsertSetting.run("data_source", "overpass");
upsertSetting.run("foursquare_api_key", process.env.FOURSQUARE_API_KEY || "");

export default db;
