# 🌾 FieldShift Local Testing & Visual Run Guide

A comprehensive, step-by-step guide to launch, visually test, and interactively verify **FieldShift** locally on your machine.

This guide focuses on **visual, in-browser, and mobile-simulation testing**—empowering developers, agricultural technicians, and evaluators to interact with the map, NASA satellite layers, telemetry charts, priority sliders, and printable advisory plans directly instead of relying solely on headless terminal tests.

---

## 📋 Table of Contents
1. [Prerequisites & One-Time Setup](#1-prerequisites--one-time-setup)
2. [Launching the Application](#2-launching-the-application)
   - [Method A: Local Vite Dev Server (Fastest, Hot Module Replacement)](#method-a-local-vite-dev-server-recommended)
   - [Method B: Production Build Preview (Test Optimized Bundle)](#method-b-production-build-preview)
   - [Method C: Mobile Field & Outdoor Sunlight Simulation (Chrome/Edge DevTools)](#method-c-mobile-field--sunlight-simulation)
3. [Day-to-Day Development & Interactive Workflow](#3-day-to-day-development--interactive-workflow)
4. [Visual Feature Verification Checklist (End-to-End Walkthrough)](#4-visual-feature-verification-checklist)
   - [Step 1: Farm Locator & NASA Satellite Layers](#step-1-farm-locator--interactive-satellite-map)
   - [Step 2: Environmental Telemetry & Soil Override](#step-2-environmental-telemetry--farmer-override)
   - [Step 3: Farm Priorities & History Configuration](#step-3-farm-priorities--crop-history)
   - [Step 4: Explainable Rotations & Climate Stress Scenarios](#step-4-explainable-rotations--climate-stress-scenarios)
   - [Bilingual (Tagalog/English) Language Toggle](#bilingual-tagalog--english-localization)
   - [Print-Ready Field Plan (`Ctrl + P`)](#print-ready-field-plan-export)
5. [Automated Quality Gates (Pre-PR Verification)](#5-automated-quality-gates)
6. [Troubleshooting & Common Pitfalls](#6-troubleshooting--common-pitfalls)

---

## 1. Prerequisites & One-Time Setup

### A. Node.js & Package Manager
FieldShift runs on modern **Node.js (v18 or higher; v20 / v22 LTS recommended)**.

1. **Verify your Node.js and npm versions:**
   ```bash
   node -v
   npm -v
   ```
2. **Install project dependencies:**
   From the repository root:
   ```bash
   npm install
   ```

### B. Environment Configuration
FieldShift includes client-safe environment variables pre-configured in `.env.example`.

1. Create your local `.env` file:
   * **Windows (PowerShell):**
     ```powershell
     Copy-Item .env.example .env
     ```
   * **macOS / Linux:**
     ```bash
     cp .env.example .env
     ```
2. Confirm the default pilot coordinates in `.env`:
   ```ini
   VITE_APP_NAME="FieldShift"
   VITE_APP_DESCRIPTION="Adapting Farms with NASA Data - Crop Rotation Decision Support"
   VITE_DEFAULT_LAT=15.714
   VITE_DEFAULT_LON=120.906
   ```

---

## 2. Launching the Application

Choose the method that best matches your testing goal:

### Method A: Local Vite Dev Server (Recommended)
*Best for active UI development, styling tweaks, and instant feedback.*

1. Start the Vite development server:
   ```bash
   npm run dev
   ```
2. Open your browser and navigate to:
   ```
   http://localhost:5173/
   ```
3. **Hot Module Replacement (HMR):** Any edits made to `.tsx`, `.ts`, or `.css` files will instantly update in your open browser without a full page reload or losing Zustand store state.

---

### Method B: Production Build Preview
*Best for validating bundle performance, asset hashing, and production-like behavior before submitting PRs.*

1. Compile the production bundle and start the preview server:
   ```bash
   npm run build
   npm run preview
   ```
2. The preview server will output a local URL (typically `http://localhost:4173/`).
3. Verify that all static icons, SVG assets, and Leaflet markers load with zero 404 network errors.

---

### Method C: Mobile Field & Sunlight Simulation
*FieldShift is designed for smallholder farmers and agricultural technicians operating mobile phones (360px+ viewport widths) under high outdoor sunlight.*

1. Launch the app using **Method A** (`npm run dev`) and open Google Chrome, Microsoft Edge, or Brave.
2. Press `F12` (or `Ctrl + Shift + I` on Windows/Linux, `Cmd + Option + I` on macOS) to open **Developer Tools**.
3. Toggle the **Device Toolbar** (`Ctrl + Shift + M` / `Cmd + Shift + M`).
4. Select a representative mobile device profile:
   * **Samsung Galaxy S20 / S8+** (360px – 412px width)
   * **Pixel 7 / 8** (412px width)
   * **iPhone 14 / 15** (390px width)
5. **Inspect Outdoor Contrast:** Confirm all text, badge chips, telemetry graphs, and interactive buttons maintain high readability against the warm `#faf8f5` sunlight background.

---

## 3. Day-to-Day Development & Interactive Workflow

### Vite Terminal Keyboard Shortcuts
While the `npm run dev` server is running in your terminal, press any of these keys:
* Press **`o`** to automatically open or focus the app in your default browser.
* Press **`r`** to force-restart the Vite dev server.
* Press **`u`** to show the local and network server URLs.
* Press **`c`** to clear the terminal screen.
* Press **`h`** to display all available Vite CLI shortcuts.

### Simulating Offline Field Resilience
FieldShift implements a **7-day persistent `localStorage` cache** and pre-bundled offline datasets in `/public/sample-data/` (*Muñoz, Ilagan, Pototan*) to function in rural areas with poor connectivity:

1. Open DevTools (`F12`) and switch to the **Network** tab.
2. In the **Throttling** dropdown (default: *No throttling*), select **Offline** or **Slow 3G**.
3. Select any of the pilot regions (e.g., *Science City of Muñoz*).
4. Verify that the application continues to display full climatology and soil profiles without error banners, gracefully serving data from offline storage.

---

## 4. Visual Feature Verification Checklist

Use this interactive checklist to visually verify each section and feature of the application:

### Step 1: Farm Locator & Interactive Satellite Map
- [ ] **Base Map Rendering:**
  - [ ] Leaflet map initializes centered on the pilot location (default: *Muñoz, Nueva Ecija*).
  - [ ] OpenStreetMap base tiles render crisp and clear without gray missing-tile patches.
- [ ] **Philippine Pilot Agricultural Presets:**
  - [ ] Clicking **"Science City of Muñoz (Nueva Ecija)"** repositions map to `15.714°, 120.906°`.
  - [ ] Clicking **"Ilagan (Isabela)"** repositions map to `17.148°, 121.889°`.
  - [ ] Clicking **"Pototan (Iloilo)"** repositions map to `10.948°, 122.628°`.
  - [ ] Clicking **"Malaybalay (Bukidnon)"** repositions map to `8.156°, 125.128°`.
  - [ ] Marker popup displays municipality name, province, and latitude/longitude.
- [ ] **Custom Field Pin Placement:**
  - [ ] Clicking anywhere on the map moves the farm pin to the clicked coordinate.
  - [ ] Dragging the marker updates latitude and longitude dynamically in the coordinate bar.
- [ ] **NASA GIBS Satellite Overlays (WMTS):**
  - [ ] Click the map layer selector in the top-right corner of the map.
  - [ ] Switch to **NASA Satellite True Color**: NASA GIBS NOAA-20/VIIRS optical reflectance renders over the agricultural plains.
  - [ ] Switch to **NASA GIBS Vegetation Greenness (NDVI)**: Vegetation index layer renders showing greenness intensity.
  - [ ] Layer legend updates dynamically with layer descriptions.
  - [ ] Satellite imagery uses original NASA colors at full opacity over an unlabeled NASA Blue Marble background. Philippine place names appear on opaque white labels above both satellite layers. Confirm there are no covered street-map labels peeking through, and that map clicks, marker dragging, and popups still work.
  - [ ] Pan and resize the map; place names should update without overlapping one another. Zoom up to 13 for more local names. Satellite requests remain capped at native zoom 9 (Blue Marble at 8); enlarged imagery does not add satellite detail. Switching to Standard Map removes the foreground labels and restores ordinary OSM cartography and zoom.
  - [ ] NDVI legend identifies the latest available rolling 8-day imagery and discloses that the exact observation date is unavailable. True Color requests the previous completed UTC day and shows the same `YYYY-MM-DD UTC` date as its tile URL. Clouds and spatial gaps can still obscure the surface.
  - [ ] Confirm the legend is below the map, leaving the imagery and place names unobstructed. Verify GeoNames attribution and the local-verification note in both languages.
  - [ ] Repeat the NDVI check at all four pilot hubs. Switch back to Standard Map and confirm normal zoom is restored.
  - [ ] To test tile failures, block `gibs.earthdata.nasa.gov` in browser developer tools and reselect NDVI. Confirm the standard map remains underneath, an error notice appears, and **Retry satellite imagery** recovers after removing the block. Repeat in Filipino.
- [ ] **Proceed Action:**
  - [ ] Click **"Confirm Field & Analyze Environment"** (or Step 2 tab) to navigate to Environmental Telemetry.

---

### Step 2: Environmental Telemetry & Farmer Override
- [ ] **NASA Climate Card (`ClimateCard.tsx`):**
  - [ ] Climatology chart (Recharts) renders 12-month precipitation bars and temperature curve.
  - [ ] Hovering over chart bars displays tooltip with exact rainfall (mm) and temperature (°C).
  - [ ] Annual rainfall total (e.g., `1,845 mm`) and monthly distribution are displayed.
  - [ ] Heat stress days counter ($T_{\max} \ge 34.0^\circ\text{C}$) displays prominently.
  - [ ] 10-year decadal drying/warming trend indicators display direction and percentage.
  - [ ] NASA Data Provenance badge indicates live/cached variables (`T2M`, `PRECTOTCORR`, `ALLSKY_SFC_SW_DWN`).
- [ ] **ISRIC SoilGrids Card (`SoilCard.tsx`):**
  - [ ] Topsoil texture breakdown displays Sand, Silt, and Clay percentages with visual stacked progress bar.
  - [ ] Soil pH rating (e.g., `pH 6.3 - Slightly Acidic`) and Soil Organic Carbon (SOC) indicators render.
- [ ] **Farmer Ground-Truth Override System:**
  - [ ] Click the **"Override / Adjust Soil"** toggle button.
  - [ ] Change soil texture (e.g., from *Clay Loam* to *Sandy Loam*) or adjust drainage status.
  - [ ] Notice the *"Farmer Override Active"* badge appear.
  - [ ] Confirm the downstream recommendation engine immediately incorporates these updated physical properties.
- [ ] **Proceed Action:**
  - [ ] Click **"Set Farm Priorities & Crop History"** (or Step 3 tab).

---

### Step 3: Farm Priorities & Crop History
- [ ] **Previous Season Crop Selection:**
  - [ ] Select a previous crop (e.g., *Lowland Rice*, *Yellow Corn*, or *Tomato*).
  - [ ] Verify botanical family is identified (e.g., *Solanaceae*, *Poaceae*, *Fabaceae*).
- [ ] **Dynamic Agronomic Priority Sliders:**
  - [ ] Adjust the 6 priority sliders:
    - [ ] **Soil Health & Regeneration** ($S_{\text{soil}}$)
    - [ ] **Water Resilience** ($S_{\text{water}}$)
    - [ ] **Stable Income & Profitability** ($S_{\text{econ}}$)
    - [ ] **Low Input Costs** ($S_{\text{cost}}$)
    - [ ] **Low Labor Intensity** ($S_{\text{labor}}$)
    - [ ] **Climate Risk Aversion** ($S_{\text{climate}}$)
  - [ ] Percentage values update smoothly in real time without UI hitching.
- [ ] **Crop Exclusion Filter:**
  - [ ] Toggle off any crop you do not wish to cultivate (e.g., deselect *Eggplant*).
  - [ ] Verify that excluded crops never appear in generated sequences.
- [ ] **Generation Trigger:**
  - [ ] Click **"Generate & Rank Rotation Plans"** (or Step 4 tab).

---

### Step 4: Explainable Rotations & Climate Stress Scenarios
- [ ] **Candidate Rotation Cards (`RotationCard.tsx`):**
  - [ ] Plans are displayed in ranked order (Plan #1, Plan #2, Plan #3) with Fit Scores (0–100).
  - [ ] Top-ranked plan features the gold/amber highlight badge.
- [ ] **3-Season Visual Timeline Strip:**
  - [ ] **Season 1 (Wet Season / Habagat):** Displays crop, icon, botanical family, and duration.
  - [ ] **Season 2 (Cool Dry / Amihan):** Displays crop, water demand badge, and nitrogen status.
  - [ ] **Season 3 (Hot Dry / Catch Window):** Displays crop and drought resistance tier.
- [ ] **Hard Constraint Enforcement:**
  - [ ] Confirm no back-to-back identical crops appear (Monoculture Ban).
  - [ ] Confirm no consecutive Solanaceae (*Tomato* $\to$ *Eggplant*) appear (Bacterial Wilt Ban).
  - [ ] Biological Nitrogen Fixation badge (`+35 to +80 kg N/ha`) displays on sequences containing legumes (*Mungbean*, *Cowpea*, *Peanut*).
- [ ] **Transparent Explainability Accordion ("Why this plan?"):**
  - [ ] Click **"Why this plan?"** to expand.
  - [ ] Details 3–5 bullet points citing specific telemetry values and rule IDs (e.g., `[AGRO-RULE-01-NFIX]`, `[AGRO-RULE-03-HYDRO-ALIGN]`).
- [ ] **Operational Risks & Mitigations Accordion:**
  - [ ] Click **"Risks & Field Mitigations"** to expand.
  - [ ] Verifies operational cautions (e.g., *flower abortion risk*, *waterlogged seedbed*) alongside farmer actions.
- [ ] **Climate Stress-Testing Scenario Bar (`ScenarioBar.tsx`):**
  - [ ] Click each climate shock button in the scenario bar:
    - [ ] **Baseline Climatology** (Historical 10-year NASA POWER averages)
    - [ ] **Hotter (+1.5°C)**
    - [ ] **Drier (-15% Rainfall / El Niño)**
    - [ ] **Hotter + Drier Compound Shock**
    - [ ] **Wetter (+15% Intense Monsoon / Typhoons)**
  - [ ] All rotation scores and ranks dynamically recalculate.
  - [ ] Verify the green **"Climate-Robust"** certification badge displays on plans that maintain stability during shock scenarios.
- [ ] **Side-by-Side Comparison Modal (`ComparisonModal.tsx`):**
  - [ ] Select 2 or 3 plans for comparison using the check/pin icon.
  - [ ] Click **"Compare Selected Plans"** in the floating action bar.
  - [ ] Modal opens displaying side-by-side pillar comparisons (Soil, Water, Econ, Climate, Labor).

---

### Bilingual (Tagalog / English) Localization
- [ ] In the top navigation bar, click the **Language Toggle** (`EN` $\leftrightarrow$ `FIL`).
- [ ] Verify all UI headers, navigation tabs, and button labels switch to formal agricultural Filipino:
  - *"Pagpapalit-palit ng Pananim"* (Crop Rotation)
  - *"Kalusugan ng Lupa"* (Soil Health)
  - *"Laban sa Tagtuyot"* (Drought Resilience)
  - *"Mga Panganib at Solusyon"* (Risks and Solutions)
- [ ] Verify agronomic explanation cards render translated rule justifications without raw string keys (e.g., no `undefined` or missing key placeholders).

---

### Print-Ready Field Plan Export
- [ ] Click the **"Print Field Plan"** button in the header (or press `Ctrl + P` / `Cmd + P`).
- [ ] In the browser print preview dialog:
  - [ ] Confirm screen navigation bars, map picker, and interactive sliders are **hidden** via `@media print`.
  - [ ] Single-page **"FieldShift · Farm Advisory Sheet"** renders cleanly.
  - [ ] Farm coordinates, advisory reference ID (`FS-xx.xx-xxxx`), date, soil profile, and 3-season crop diagram format neatly within standard A4 / Letter boundaries.
  - [ ] Farmer note-taking / extension worker signature section appears at the bottom.

---

## 5. Automated Quality Gates

Before submitting code changes, pushing to a branch, or opening a Pull Request, run the complete project quality checks:

```bash
# 1. Vitest Unit Test Suite (100% pass across recommendation engine & scenarios)
npm test

# 2. Strict TypeScript Compile & Type Check
npx tsc -b

# 3. Fast Code Quality Linting (Oxlint)
npm run lint

# 4. Production Build Test
npm run build
```

> [!NOTE]
> All automated tests, type definitions, and linter rules must pass with **zero errors**.

---

## 6. Troubleshooting & Common Pitfalls

| Symptom | Root Cause | Solution |
|---|---|---|
| **Map shows gray squares / missing tiles** | Leaflet container rendered before container height was resolved, or network dropped. | Ensure `#map` container has an explicit CSS height (e.g., `h-[420px]`). In DevTools, resize window slightly or re-select a pilot preset to trigger Leaflet `map.invalidateSize()`. |
| **NASA GIBS satellite layer appears blank or black** | Missing observations, clouds, incomplete latest-day processing, or failed tile requests can leave gaps. HTTP 200 alone does not guarantee visible imagery. | NDVI uses NASA's `default` time alias; its exact observation date is not retrieved. True Color uses the previous completed UTC day, captured on selection/retry, and shows that requested date. NASA Blue Marble fills uncovered areas without buried street-map labels; if its requests fail, the OSM base is restored and a warning appears. View zoom can reach 13, while `maxNativeZoom` prevents requests beyond imagery level 9/background level 8. Use **Retry satellite imagery** or **Standard Map**. Tile requests use normal browser HTTP caching and Leaflet in-view tile reuse; no application-managed tile cache or 7-day JSON TTL is applied to imagery. |
| **NASA POWER API request times out or CORS error** | Slow public government API response or offline field testing. | The app automatically catches network timeouts and falls back to cached data or pre-bundled municipal datasets in `/public/sample-data/`. Check DevTools Console for fallback notifications. |
| **Vite port `5173` already in use** | A lingering Vite or Node development process is occupying the default port. | Specify an alternate port: `npm run dev -- --port 5174` or terminate the lingering Node process. |
| **Print view (`Ctrl + P`) clips or splits onto 2 pages** | Browser print scale is set too high or margins are custom. | In the browser Print Dialog, set **Margins: Minimum** or **Default**, and ensure **Scale: 100%** (or *Fit to printable area*). The stylesheet includes `@media print` rules specifically designed for single-page A4 output. |
| **Untranslated text or raw key displayed** | A new UI string was added in English (`src/i18n/en.json`) but omitted from Filipino (`src/i18n/fil.json`). | Check both translation JSON files for parity. Add the corresponding key to both `en.json` and `fil.json`. |


## 7. Foreground Place-Name Reference Data

`src/data/philippinePlaces.json` contains 1,955 Philippine populated-place records derived from the [GeoNames country extract](https://download.geonames.org/export/dump/PH.zip), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Source URL, retrieval timestamp, original archive SHA-256, selection, and review limitations are recorded in the JSON. This is cartography, not NASA telemetry, farm boundaries, or a complete municipal register. Both satellite imagery products and the unlabeled background remain NASA GIBS resources. Attribution is displayed in the map and legend. No GeoNames account, runtime API call, or additional dependency is required.

The extract preserves each selected record's ID, primary name, WGS84 latitude/longitude, and population. Selection keeps PH feature class P with codes PPLC/PPLA/PPLA2/PPLA3, plus PPL records whose population is at least 5,000. Population only prioritizes colliding labels; it does not affect agricultural calculations. The source columns, indexed from zero, are ID 0, name 1, latitude 4, longitude 5, class 6, code 7, country 8, and population 14. Other source columns are omitted; sort by population descending, then ID ascending. To refresh, repeat that extraction from a newly downloaded PH.zip/PH.txt, update provenance and checksum, and run the map-label tests and normal quality gates. Source names and coordinates need local verification; existing pilot coordinates and agricultural fixtures are preserved.

Zod validates the bundled reference before use. At most 70 labels are drawn for the visible map, with collision filtering, viewport clipping, and exclusion of the layer-selector area. Pan/resize updates the labels; selecting Standard Map or unmounting removes listeners and markers. Zoom up to 13 adds local place context while NASA image requests stay at native zoom limits. The bundled labels add about 45 kB to the compressed application bundle in this implementation.

True Color selects the previous completed UTC day from NASA GIBS NOAA-20/VIIRS. This is recent daily imagery, not live or guaranteed cloud-free coverage. Completely black no-observation JPEG tiles (including HTTP 200 responses) are hidden to reveal the disclosed static NASA background. Colored pixels and cloud imagery are preserved; if canvas inspection is unavailable, imagery is left visible. Check fallback notices and static-background disclosure rather than treating the background as current observations or NDVI.
