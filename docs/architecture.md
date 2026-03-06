# Architecture - My Pubs Map

## Vue d'ensemble

Application monorepo composee de deux parties :
- **client/** : SPA (Single Page Application) avec Vite, TypeScript et Leaflet
- **server/** : API REST avec Express, TypeScript et SQLite

## Frontend (client/)

### Fichiers principaux
- `index.html` : page unique de l'application
- `src/main.ts` : point d'entree, orchestration UI, gestion des evenements
- `src/map.ts` : gestion de la carte Leaflet (markers, cercle de rayon, position)
- `src/api.ts` : client HTTP vers le backend
- `src/style.css` : styles CSS

### Flux utilisateur
1. L'app demande la geolocalisation du navigateur
2. L'utilisateur ajuste le rayon via le slider (1-20 km)
3. Clic sur "Rechercher" -> appel API -> affichage des bars sur carte + liste
4. Clic sur la checkbox d'un bar -> toggle visite (sauvegarde backend)
5. Clic sur un bar dans la liste -> zoom sur la carte
6. Barre de recherche pour filtrer les bars par nom
7. Stats en temps reel : "X / Y visites" avec barre de progression

### Design
- Theme sombre (dark mode) avec palette definie en CSS variables
- CartoDB dark tiles pour la carte
- Popups Leaflet stylises en dark
- Markers : cercles colores (rouge = pas visite, vert = visite)
- Position utilisateur avec effet pulse anime
- Font : Inter (Google Fonts)

### Mobile
- Sidebar en bottom drawer (glisse depuis le bas)
- Handle tactile pour ouvrir/fermer
- Sidebar se ferme au clic sur un bar, s'ouvre apres une recherche
- Header responsive en colonne sur petit ecran

### Proxy dev
Vite proxie `/api` vers `http://localhost:3001` en mode developpement.

## Backend (server/)

### Fichiers principaux
- `src/index.ts` : serveur Express (port 3001)
- `src/db.ts` : connexion SQLite, creation de la table
- `src/overpass.ts` : client Overpass API pour recuperer les bars OSM
- `src/routes/bars.ts` : routes REST

### Base de donnees (SQLite)
Table `visited_bars` :
| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER | PK auto-increment |
| osm_id | TEXT | ID OpenStreetMap (unique) |
| name | TEXT | Nom du bar |
| lat | REAL | Latitude |
| lon | REAL | Longitude |
| visited_at | TEXT | Date de visite (auto) |
| notes | TEXT | Notes optionnelles |

### Endpoints API
| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/api/bars/nearby?lat=&lon=&radius=` | Bars proches via Overpass API |
| GET | `/api/bars/visited` | Liste des bars visites |
| POST | `/api/bars/visited` | Marquer un bar comme visite |
| DELETE | `/api/bars/visited/:osm_id` | Retirer un bar des visites |

## Overpass API
L'application interroge l'Overpass API (donnees OpenStreetMap) pour trouver les bars et pubs dans un rayon donne. Aucune cle API n'est necessaire.

Requete type (bounding box pour les performances) :
```
[out:json][timeout:60];
node["amenity"~"^(bar|pub)$"]({south},{west},{north},{east});
out body;
```
