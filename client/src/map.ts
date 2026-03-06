import L from "leaflet";
import type { Bar } from "./api";

const VISITED_COLOR = "#51cf66";
const DEFAULT_COLOR = "#ff6b6b";
const USER_COLOR = "#339af0";

let map: L.Map;
let markersLayer: L.LayerGroup;
let userMarker: L.Marker | null = null;
let userPulse: L.CircleMarker | null = null;
let radiusCircle: L.Circle | null = null;
const markerMap = new Map<string, { marker: L.CircleMarker; bar: Bar }>();

function createBarIcon(visited: boolean): L.DivIcon {
  const color = visited ? VISITED_COLOR : DEFAULT_COLOR;
  return L.divIcon({
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:${color};
      border:2.5px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,0.35);
      transition: all 0.3s ease;
    "></div>`,
  });
}

export function initMap(containerId: string): L.Map {
  map = L.map(containerId, {
    zoomControl: false,
  }).setView([48.8566, 2.3522], 14);

  L.control.zoom({ position: "topright" }).addTo(map);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19,
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  return map;
}

export function setUserPosition(lat: number, lon: number, radiusKm: number) {
  if (userMarker) map.removeLayer(userMarker);
  if (userPulse) map.removeLayer(userPulse);
  if (radiusCircle) map.removeLayer(radiusCircle);

  // Pulsing circle behind user marker
  userPulse = L.circleMarker([lat, lon], {
    radius: 20,
    fillColor: USER_COLOR,
    color: "transparent",
    fillOpacity: 0.15,
    className: "user-pulse",
  }).addTo(map);

  // User position marker
  const userIcon = L.divIcon({
    className: "",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    html: `<div style="
      width:18px;height:18px;border-radius:50%;
      background:${USER_COLOR};
      border:3px solid #fff;
      box-shadow:0 0 12px rgba(51,154,240,0.5), 0 2px 8px rgba(0,0,0,0.3);
    "></div>`,
  });
  userMarker = L.marker([lat, lon], { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
  userMarker.bindPopup(
    '<div class="popup-name">Vous etes ici</div>'
  );

  radiusCircle = L.circle([lat, lon], {
    radius: radiusKm * 1000,
    color: USER_COLOR,
    fillColor: USER_COLOR,
    fillOpacity: 0.04,
    weight: 1,
    dashArray: "6 4",
  }).addTo(map);

  map.fitBounds(radiusCircle.getBounds(), { padding: [20, 20] });
}

export function displayBars(
  bars: Bar[],
  visitedIds: Set<string>,
  onBarClick: (bar: Bar) => void
) {
  markersLayer.clearLayers();
  markerMap.clear();

  for (const bar of bars) {
    const isVisited = visitedIds.has(bar.osm_id);
    const marker = L.circleMarker([bar.lat, bar.lon], {
      radius: 7,
      fillColor: isVisited ? VISITED_COLOR : DEFAULT_COLOR,
      color: "#fff",
      weight: 2,
      fillOpacity: 0.9,
    });

    marker.bindPopup(buildPopup(bar.name, isVisited));
    marker.bindTooltip(bar.name, {
      direction: "top",
      offset: [0, -8],
      className: "bar-tooltip",
    });
    marker.on("click", () => onBarClick(bar));
    marker.addTo(markersLayer);
    markerMap.set(bar.osm_id, { marker, bar });
  }
}

function buildPopup(name: string, visited: boolean): string {
  return `
    <div class="popup-name">${name}</div>
    <div class="popup-status${visited ? " visited" : ""}">${visited ? "Visite !" : "Pas encore visite"}</div>
  `;
}

export function updateMarkerStyle(osm_id: string, visited: boolean) {
  const entry = markerMap.get(osm_id);
  if (entry) {
    entry.marker.setStyle({
      fillColor: visited ? VISITED_COLOR : DEFAULT_COLOR,
    });
    entry.marker.setPopupContent(buildPopup(entry.bar.name, visited));
  }
}

export function panTo(lat: number, lon: number) {
  map.setView([lat, lon], 17, { animate: true, duration: 0.5 });
  const entry = [...markerMap.values()].find((e) => {
    const ll = e.marker.getLatLng();
    return ll.lat === lat && ll.lng === lon;
  });
  if (entry) {
    setTimeout(() => entry.marker.openPopup(), 300);
  }
}

export function onMapClick(
  mapInstance: L.Map,
  callback: (lat: number, lon: number) => void
) {
  mapInstance.on("contextmenu", (e: L.LeafletMouseEvent) => {
    callback(e.latlng.lat, e.latlng.lng);
  });
}
