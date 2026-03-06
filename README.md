# My Pubs Map

Application web pour tracker les bars et pubs que tu as visites, affiches sur une carte interactive.

## Fonctionnalites

- Geolocalisation automatique
- Recherche de bars dans un rayon de 1 a 20 km (slider)
- Carte interactive (Leaflet + OpenStreetMap)
- Marquage des bars visites (sauvegarde en base de donnees)
- Filtrage : tous / visites / pas visites
- Les bars visites apparaissent en vert sur la carte et dans la liste

## Prerequis

- Node.js >= 18

## Installation

```bash
npm install
npm run install:all
```

## Lancement

```bash
npm run dev
```

Ouvre http://localhost:5173 dans ton navigateur.

- Frontend : port 5173
- Backend : port 3001

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Frontend | Vite + TypeScript + Leaflet |
| Backend | Express + TypeScript |
| Base de donnees | SQLite (better-sqlite3) |
| Donnees bars | Overpass API (OpenStreetMap) |
| Carte | OpenStreetMap tiles |

## API

Voir [docs/architecture.md](docs/architecture.md) pour les details.
