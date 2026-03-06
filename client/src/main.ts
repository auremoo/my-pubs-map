import "leaflet/dist/leaflet.css";
import "./style.css";
import {
  fetchNearbyBars,
  fetchVisitedBars,
  markVisited,
  unmarkVisited,
  addCustomBar,
  fetchSettings,
  saveSettings,
  type Bar,
} from "./api";
import {
  initMap,
  setUserPosition,
  displayBars,
  updateMarkerStyle,
  panTo,
  onMapClick,
} from "./map";

let currentBars: Bar[] = [];
let visitedIds = new Set<string>();
let userLat = 0;
let userLon = 0;
let currentFilter: "all" | "visited" | "not-visited" = "all";
let searchQuery = "";
let currentSource = "overpass";

const radiusSlider = document.getElementById("radius") as HTMLInputElement;
const radiusValue = document.getElementById("radius-value")!;
const searchBtn = document.getElementById("search-btn") as HTMLButtonElement;
const barList = document.getElementById("bar-list")!;
const barCount = document.getElementById("bar-count")!;
const filterBtns = document.querySelectorAll<HTMLButtonElement>(".filter-btn");
const statsText = document.getElementById("stats-text")!;
const statsFill = document.getElementById("stats-fill")!;
const searchInput = document.getElementById("search-input") as HTMLInputElement;
const sidebar = document.getElementById("sidebar")!;
const sidebarHandle = document.getElementById("sidebar-handle")!;

// Settings elements
const settingsBtn = document.getElementById("settings-btn")!;
const settingsModal = document.getElementById("settings-modal")!;
const settingsCancel = document.getElementById("settings-cancel")!;
const settingsSave = document.getElementById("settings-save")!;
const fsqKeyGroup = document.getElementById("fsq-key-group")!;
const overpassInfo = document.getElementById("overpass-info")!;
const fsqKeyInput = document.getElementById("fsq-key") as HTMLInputElement;
const dataSourceRadios = document.querySelectorAll<HTMLInputElement>(
  'input[name="data_source"]'
);

// Add bar elements
const addBarModal = document.getElementById("add-bar-modal")!;
const addBarCancel = document.getElementById("add-bar-cancel")!;
const addBarConfirm = document.getElementById("add-bar-confirm")!;
const addBarName = document.getElementById("add-bar-name") as HTMLInputElement;
const addBarCoords = document.getElementById("add-bar-coords")!;

let pendingBarLat = 0;
let pendingBarLon = 0;

const map = initMap("map");

// ── Settings ────────────────────────────────

settingsBtn.addEventListener("click", async () => {
  const settings = await fetchSettings();
  currentSource = settings.data_source;

  // Set radio
  dataSourceRadios.forEach((r) => {
    r.checked = r.value === settings.data_source;
  });
  fsqKeyInput.value = settings.foursquare_api_key || "";
  updateSettingsUI(settings.data_source);

  settingsModal.classList.remove("hidden");
});

dataSourceRadios.forEach((r) => {
  r.addEventListener("change", () => updateSettingsUI(r.value));
});

function updateSettingsUI(source: string) {
  fsqKeyGroup.style.display = source === "foursquare" ? "block" : "none";
  overpassInfo.style.display = source === "overpass" ? "block" : "none";
}

settingsCancel.addEventListener("click", () => {
  settingsModal.classList.add("hidden");
});

settingsModal.querySelector(".modal-backdrop")!.addEventListener("click", () => {
  settingsModal.classList.add("hidden");
});

settingsSave.addEventListener("click", async () => {
  const source =
    document.querySelector<HTMLInputElement>('input[name="data_source"]:checked')?.value ||
    "overpass";
  await saveSettings({
    data_source: source,
    foursquare_api_key: fsqKeyInput.value.trim(),
  });
  currentSource = source;
  settingsModal.classList.add("hidden");
  loadBars();
});

// ── Add bar (map click, only in overpass mode) ──

onMapClick(map, (lat: number, lon: number) => {
  if (currentSource !== "overpass") return;
  pendingBarLat = lat;
  pendingBarLon = lon;
  addBarCoords.textContent = `Position : ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  addBarName.value = "";
  addBarModal.classList.remove("hidden");
  addBarName.focus();
});

addBarCancel.addEventListener("click", () => {
  addBarModal.classList.add("hidden");
});

addBarModal.querySelector(".modal-backdrop")!.addEventListener("click", () => {
  addBarModal.classList.add("hidden");
});

addBarConfirm.addEventListener("click", async () => {
  const name = addBarName.value.trim();
  if (!name) return;

  const result = await addCustomBar(name, pendingBarLat, pendingBarLon);
  addBarModal.classList.add("hidden");

  // Add to current bars and re-render
  const newBar: Bar = {
    osm_id: result.osm_id,
    name,
    lat: pendingBarLat,
    lon: pendingBarLon,
  };
  currentBars.push(newBar);
  currentBars.sort(
    (a, b) =>
      distanceKm(userLat, userLon, a.lat, a.lon) -
      distanceKm(userLat, userLon, b.lat, b.lon)
  );
  displayBars(currentBars, visitedIds, toggleVisited);
  updateStats();
  renderBarList();
});

// Allow Enter key in add bar modal
addBarName.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addBarConfirm.click();
});

// ── Mobile drawer toggle ────────────────────

sidebarHandle.addEventListener("click", () => {
  sidebar.classList.toggle("expanded");
});

// Radius slider
radiusSlider.addEventListener("input", () => {
  radiusValue.textContent = radiusSlider.value;
});

// Search input
searchInput.addEventListener("input", () => {
  searchQuery = searchInput.value.toLowerCase();
  renderBarList();
});

// Filter buttons
filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter as typeof currentFilter;
    renderBarList();
  });
});

// Search button
searchBtn.addEventListener("click", () => {
  loadBars();
});

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

function updateStats() {
  const total = currentBars.length;
  const visited = currentBars.filter((b) => visitedIds.has(b.osm_id)).length;
  statsText.textContent = `${visited} / ${total} visites`;
  statsFill.style.width = total > 0 ? `${(visited / total) * 100}%` : "0%";
}

function renderBarList() {
  const filtered = currentBars.filter((bar) => {
    if (currentFilter === "visited" && !visitedIds.has(bar.osm_id)) return false;
    if (currentFilter === "not-visited" && visitedIds.has(bar.osm_id)) return false;
    if (searchQuery && !bar.name.toLowerCase().includes(searchQuery)) return false;
    return true;
  });

  barCount.textContent = `${filtered.length}`;

  barList.innerHTML = "";

  if (filtered.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.innerHTML = `
      <div class="empty-state-icon">&#127866;</div>
      <div class="empty-state-text">${
        currentBars.length === 0
          ? "Lancez une recherche pour trouver des bars"
          : "Aucun bar ne correspond aux filtres"
      }</div>
    `;
    barList.append(empty);
    return;
  }

  for (const bar of filtered) {
    const isVisited = visitedIds.has(bar.osm_id);
    const dist = distanceKm(userLat, userLon, bar.lat, bar.lon);

    const li = document.createElement("li");
    li.className = `bar-item${isVisited ? " visited" : ""}`;

    const check = document.createElement("div");
    check.className = `bar-check${isVisited ? " checked" : ""}`;
    check.innerHTML = isVisited ? "&#10003;" : "";
    check.addEventListener("click", async (e) => {
      e.stopPropagation();
      await toggleVisited(bar);
    });

    const info = document.createElement("div");
    info.className = "bar-info";

    const name = document.createElement("div");
    name.className = "bar-name";
    name.textContent = bar.name;

    const distance = document.createElement("div");
    distance.className = "bar-distance";
    distance.textContent =
      dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`;

    info.append(name, distance);
    li.append(check, info);
    li.addEventListener("click", () => {
      panTo(bar.lat, bar.lon);
      if (window.innerWidth <= 768) {
        sidebar.classList.remove("expanded");
      }
    });
    barList.append(li);
  }
}

async function toggleVisited(bar: Bar) {
  if (visitedIds.has(bar.osm_id)) {
    await unmarkVisited(bar.osm_id);
    visitedIds.delete(bar.osm_id);
  } else {
    await markVisited(bar);
    visitedIds.add(bar.osm_id);
  }
  updateMarkerStyle(bar.osm_id, visitedIds.has(bar.osm_id));
  updateStats();
  renderBarList();
}

function showLoading(show: boolean) {
  const existing = document.querySelector(".loading-overlay");
  if (show && !existing) {
    const overlay = document.createElement("div");
    overlay.className = "loading-overlay";
    overlay.innerHTML = '<div class="loading-spinner">Recherche des bars...</div>';
    document.body.append(overlay);
  } else if (!show && existing) {
    existing.remove();
  }
}

async function loadBars() {
  const radius = parseInt(radiusSlider.value);
  searchBtn.disabled = true;
  showLoading(true);

  try {
    const [bars, visited] = await Promise.all([
      fetchNearbyBars(userLat, userLon, radius),
      fetchVisitedBars(),
    ]);

    currentBars = bars.sort(
      (a, b) =>
        distanceKm(userLat, userLon, a.lat, a.lon) -
        distanceKm(userLat, userLon, b.lat, b.lon)
    );
    visitedIds = new Set(visited.map((v) => v.osm_id));

    setUserPosition(userLat, userLon, radius);
    displayBars(currentBars, visitedIds, toggleVisited);
    updateStats();
    renderBarList();

    if (window.innerWidth <= 768) {
      sidebar.classList.add("expanded");
    }
  } catch (err) {
    console.error(err);
    alert("Erreur lors de la recherche des bars. Reessayez.");
  } finally {
    searchBtn.disabled = false;
    showLoading(false);
  }
}

// ── Init ────────────────────────────────────

async function init() {
  // Load settings
  try {
    const settings = await fetchSettings();
    currentSource = settings.data_source;
  } catch {
    // defaults
  }

  // Geolocation
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userLat = pos.coords.latitude;
        userLon = pos.coords.longitude;
        loadBars();
      },
      (err) => {
        console.error("Geolocation error:", err);
        alert(
          "Impossible d'obtenir votre position. Autorisez la geolocalisation et rechargez la page."
        );
        userLat = 48.8566;
        userLon = 2.3522;
        loadBars();
      }
    );
  } else {
    alert("Votre navigateur ne supporte pas la geolocalisation.");
    userLat = 48.8566;
    userLon = 2.3522;
    loadBars();
  }
}

init();
