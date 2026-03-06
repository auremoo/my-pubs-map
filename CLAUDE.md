# My Pubs Map

## Project Overview
Web app to track bars/pubs you've visited, displayed on an interactive map.
Uses geolocation to find nearby bars via OpenStreetMap data.

## Architecture
- **Monorepo** with `client/` and `server/` directories
- **Frontend**: Vite + TypeScript + Leaflet (CartoDB dark tiles)
- **Backend**: Express + TypeScript + SQLite (better-sqlite3)
- **Data sources**: Overpass API (OpenStreetMap) OR Foursquare Places API (configurable)
- **Custom bars**: Users can add bars manually (right-click on map, Overpass mode only)
- Foursquare requires API key (configured in app settings)

## Key Commands
```bash
npm run install:all   # Install all dependencies
npm run dev           # Start both client (5173) and server (3001) concurrently
npm run build         # Build both client and server
```

## Project Structure
```
client/               # Vite + TypeScript frontend
  src/
    main.ts           # App entry point, orchestration, mobile drawer, search filter
    map.ts            # Leaflet map management (dark tiles, custom markers, pulse)
    api.ts            # API client (fetch calls to backend)
    style.css         # All styles (dark theme, responsive mobile drawer)
  index.html          # Single page (Inter font, stats bar, search input)
server/               # Express + TypeScript backend
  src/
    index.ts          # Express server entry point (port 3001)
    db.ts             # SQLite database setup and connection
    overpass.ts       # Overpass API client (fetch bars from OSM)
    foursquare.ts     # Foursquare Places API client
    routes/bars.ts    # REST API routes (bars, custom bars, settings)
  data/               # SQLite database file (gitignored)
docs/
  architecture.md     # Detailed architecture documentation
```

## API Endpoints
- `GET /api/bars/nearby?lat=&lon=&radius=` - Fetch bars (source depends on settings)
- `GET /api/bars/visited` - List all visited bars
- `POST /api/bars/visited` - Mark a bar as visited
- `DELETE /api/bars/visited/:osm_id` - Unmark a visited bar
- `POST /api/bars/custom` - Add a custom bar (body: {name, lat, lon})
- `DELETE /api/bars/custom/:id` - Delete a custom bar
- `GET /api/bars/settings` - Get app settings
- `PUT /api/bars/settings` - Update settings (body: {data_source, foursquare_api_key})

## Conventions
- TypeScript strict mode everywhere
- No framework on frontend (vanilla TS + Leaflet)
- Vite proxies `/api` to backend in dev mode
- SQLite DB auto-created in `server/data/pubs.db`

## Dev workflow
- **Frontend** (client/): Vite HMR, hot reloads automatically on save
- **Backend** (server/): NO hot reload. After modifying server files, kill port 3001 and restart:
  ```bash
  npx kill-port 3001 && cd server && npm run dev
  ```
  Or kill all and restart everything: `npx kill-port 3001 5173 && npm run dev`
