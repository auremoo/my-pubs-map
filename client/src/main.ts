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
  updateNotes,
  searchAddress,
  type Bar,
  type VisitedBar,
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
let visitedNotes = new Map<string, string>();
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

// Address search elements
const addBarAddress = document.getElementById("add-bar-address") as HTMLInputElement;
const addressSearchBtn = document.getElementById("address-search-btn")!;
const addressResults = document.getElementById("address-results")!;

// Notes modal elements
const notesModal = document.getElementById("notes-modal")!;
const notesModalTitle = document.getElementById("notes-modal-title")!;
const notesTextarea = document.getElementById("notes-textarea") as HTMLTextAreaElement;
const notesCancel = document.getElementById("notes-cancel")!;
const notesSave = document.getElementById("notes-save")!;
let notesBarId = "";

// Export button
const exportBtn = document.getElementById("export-btn")!;

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
  addBarAddress.value = "";
  addressResults.innerHTML = "";
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

// ── Address search (Nominatim) ──────────

async function doAddressSearch() {
  const query = addBarAddress.value.trim();
  if (!query) return;
  addressResults.innerHTML = '<li class="address-item" style="color:var(--text-muted)">Recherche...</li>';
  try {
    const results = await searchAddress(query);
    addressResults.innerHTML = "";
    if (results.length === 0) {
      addressResults.innerHTML = '<li class="address-item" style="color:var(--text-muted)">Aucun resultat</li>';
      return;
    }
    for (const r of results) {
      const li = document.createElement("li");
      li.className = "address-item";
      li.textContent = r.display_name;
      li.addEventListener("click", () => {
        pendingBarLat = r.lat;
        pendingBarLon = r.lon;
        addBarCoords.textContent = `Position : ${r.lat.toFixed(5)}, ${r.lon.toFixed(5)}`;
        addressResults.innerHTML = "";
        addBarAddress.value = "";
      });
      addressResults.append(li);
    }
  } catch {
    addressResults.innerHTML = '<li class="address-item" style="color:var(--text-muted)">Erreur de recherche</li>';
  }
}

addressSearchBtn.addEventListener("click", doAddressSearch);
addBarAddress.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    doAddressSearch();
  }
});

// ── Notes modal ─────────────────────────

function openNotesModal(bar: Bar) {
  notesBarId = bar.osm_id;
  notesModalTitle.textContent = `Notes - ${bar.name}`;
  notesTextarea.value = visitedNotes.get(bar.osm_id) || "";
  notesModal.classList.remove("hidden");
  notesTextarea.focus();
}

notesCancel.addEventListener("click", () => {
  notesModal.classList.add("hidden");
});

notesModal.querySelector(".modal-backdrop")!.addEventListener("click", () => {
  notesModal.classList.add("hidden");
});

notesSave.addEventListener("click", async () => {
  const notes = notesTextarea.value.trim();
  await updateNotes(notesBarId, notes);
  if (notes) {
    visitedNotes.set(notesBarId, notes);
  } else {
    visitedNotes.delete(notesBarId);
  }
  notesModal.classList.add("hidden");
  renderBarList();
});

// ── Export ───────────────────────────────

exportBtn.addEventListener("click", async () => {
  try {
    const res = await fetch("/api/bars/export");
    if (!res.ok) throw new Error("Export failed");
    const data = await res.json();

    // Build CSV
    const lines = ["Nom,Latitude,Longitude,Visite,Date visite,Notes"];
    for (const v of data.visited) {
      lines.push(`"${v.name.replace(/"/g, '""')}",${v.lat},${v.lon},Oui,${v.visited_at},"${(v.notes || "").replace(/"/g, '""')}"`);
    }
    for (const c of data.custom) {
      const isVisited = data.visited.some((v: { osm_id: string }) => v.osm_id === `custom/${c.id}`);
      if (!isVisited) {
        lines.push(`"${c.name.replace(/"/g, '""')}",${c.lat},${c.lon},Non,,`);
      }
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `my-pubs-map-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    alert("Erreur lors de l'export.");
  }
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

    const notes = visitedNotes.get(bar.osm_id);
    if (notes) {
      const notesHint = document.createElement("div");
      notesHint.className = "bar-notes-indicator";
      notesHint.textContent = notes;
      info.append(name, distance, notesHint);
    } else {
      info.append(name, distance);
    }

    if (isVisited) {
      const notesBtn = document.createElement("button");
      notesBtn.className = "bar-notes-btn";
      notesBtn.textContent = notes ? "Notes" : "+ Note";
      notesBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openNotesModal(bar);
      });
      li.append(check, info, notesBtn);
    } else {
      li.append(check, info);
    }

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
    visitedNotes = new Map(
      visited.filter((v) => v.notes).map((v) => [v.osm_id, v.notes!])
    );

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
