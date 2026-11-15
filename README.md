# AniTala: Guided by the stars, growing toward a better harvest

> **NASA Space Apps Challenge 2026**  
> **Challenge:** [Field Shift: Adapting Farms with NASA Data](https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/)  
> **Team:** Moon Chanter  
> **Live Demo:** [https://anitala.vercel.app](https://anitala.vercel.app)  
> **Repository:** [https://github.com/knet-the-traveller/Moon-Chanter.git](https://github.com/knet-the-traveller/Moon-Chanter.git)

---

## 📌 Naming Note

- **AniTala** (from Tagalog *Ani* [harvest] + *Tala* [guiding star]) is the public product name for the complete application, encompassing the introductory landing page and the seasonal crop rotation planner.
- **FieldShift** is the internal module name used across the codebase (`src/components/`, `src/engine/`, `src/services/`) and currently appears in the planner screen header.
- **"Field Shift: Adapting Farms with NASA Data"** is the official 2026 NASA Space Apps Challenge title.
- *GabayAni* was an early working title and is fully deprecated; it does not appear in user-facing views.

---

## 🌾 Project Overview

AniTala helps Philippine farmers explore crop-rotation plans that protect soil health and cope with shifting temperature, rainfall, and water conditions. It combines NASA POWER climate records and NASA GIBS satellite layers with global soil data, crop traits, and each farmer's own priorities, and tests plans under hotter, drier, and wetter scenarios. It is decision support, not a yield forecast.

Developed for smallholder farmers and municipal agricultural extension technicians in the Philippines, AniTala addresses the **2026 NASA Space Apps Challenge ("Field Shift: Adapting Farms with NASA Data")** by translating satellite observations and digital soil maps into transparent, explainable seasonal rotation schedules.

> [!NOTE]
> AniTala is designed as a supportive decision-exploration co-pilot—it helps farmers explore agro-climatic patterns and rotation options, but does not replace farmer judgment or local agricultural extension expertise. It is decision support, not a yield forecast.

### Key Capabilities
- **Pick a Pilot Farm:** Select one of four Philippine agricultural pilot municipalities or specify coordinates within pilot bounds.
- **Confirm Soil & Topography:** Review SoilGrids 2.0 topsoil attributes (sand, silt, clay, pH, organic carbon) with a one-tap **Farmer Soil Override** to reflect local ground knowledge.
- **Set Farm Priorities:** Adjust weight sliders across Soil Health, Water Resilience, Stable Income, Low Costs, Low Labor, and Climate Risk.
- **Ranked 3-Season Rotations:** Receive deterministic candidate sequences partitioned across the Philippine monsoon calendar:
  - **Wet Season / *Habagat*** (June – October)
  - **Cool Dry Season / *Amihan*** (November – February)
  - **Hot Dry Season / *Tag-init*** (March – May)
- **Climate Shock Stress-Testing:** Stress-test every rotation under 5 climate scenarios (Baseline, Hotter, Drier, Hotter + Drier compound shock, Wetter). Plans maintaining stability earn the **"Climate-Robust"** designation.
- **Bilingual Interface:** Instant bilingual toggle between **English** and **Filipino / Tagalog** (`src/i18n/`, `src/landing/i18n/`).
- **Print & Share:** Generate a clean printable one-page advisory sheet (`Ctrl+P` / `"Print Field Plan"`) for field distribution.

---

## 🛰️ Data Sources & Telemetry

AniTala strictly discloses the source, resolution, and temporal bounds for all consumed telemetry:

### Active Telemetry (Used in Current Code)

| Dataset | Source / Platform | Spatial & Temporal Resolution | Application in AniTala | Status |
| :--- | :--- | :--- | :--- | :--- |
| **NASA POWER Daily Point API** | NASA Langley Research Center (LaRC) | 0.5° × 0.5° grid (~55 km); 10 complete calendar years (2014-01-01 to 2023-12-31, 3,652 daily records) | Rainfall (`PRECTOTCORR`), temperatures (`T2M`, `T2M_MAX`), heat stress days ($T_{\max} \ge 34^\circ\text{C}$ and $\ge 35^\circ\text{C}$), solar irradiance (`ALLSKY_SFC_SW_DWN`), humidity (`RH2M`). | **Live API** with pre-bundled sample fallback |
| **NASA GIBS WMTS** | NASA EOSDIS Global Imagery Browse Services | 250 m optical; EPSG:3857 Web Mercator tiles | Interactive Leaflet satellite map layers: MODIS Terra True Color (Corrected Reflectance) and MODIS 8-Day NDVI vegetation greenness. | **Live Tiles** |
| **ISRIC SoilGrids v2.0** | ISRIC — World Soil Information | 250 m global digital soil mapping; topsoil 0–5 cm and 5–15 cm intervals | Topsoil physical texture (sand, silt, clay fractions in %), soil pH ($-\log_{10}[\text{H}^+]$), soil organic carbon (SOC in dg/kg), and bulk density (cg/cm³). | **Live API** with pre-bundled native GeoTIFF sample fallback |
| **Philippine Crop Agronomy Database** | PhilRice, DA-BSWM, FAO, IRRI reference data | 15 localized crop profiles (`src/data/crops.json`) | Calibrated base parameters for crop families, water demand, heat sensitivity, biological nitrogen fixation, and root architecture. | **Local Database** |

### Planned / Partial / Partner Datasets (In Fixture Schema or Challenge Catalog)

The following datasets are defined in the municipal fixture schema (`public/sample-data/*.json`) or cataloged in `docs/DATA_SOURCES.md`, but are currently marked `status: "unavailable"` in live runs because they require Earthdata authentication tokens, raster tile pre-processing, or specialized disaggregation:

- **NASA SMAP L3 Radiometer Global Daily 9 km (SPL3SMP_E v006):** Planned for root-zone and surface soil moisture tracking to guide post-monsoon relay legume planting.
- **NASA JPL ECOSTRESS Evaporative Stress Index PT-JPL 70 m (ECO4ESI v002):** Planned for canopy thermal stress hotspot detection.
- **NASA SRTMGL1 v003 30 m:** Planned for Digital Elevation Model (DEM) slope and field drainage basin classification.
- **NASA GPM / IMERG 0.1°:** Extreme rainstorm frequency is currently derived from 10-year NASA POWER daily records (`extremeRainDays`), with high-resolution IMERG storm tracking planned for future updates.
- **ESA Copernicus Sentinel-2:** Space Agency partner resource (10 m optical/NIR/SWIR) planned for fine-scale vegetative cover and field-scale monitoring.
- **ECMWF ERA5 Reanalysis:** Space Agency partner resource (0.25° reanalysis) planned for localized microclimate gap-filling.

---

## ⚙️ How It Works

AniTala implements a deterministic, transparent, 100% explainable agronomic engine (`src/engine/`):

1. **Monsoon Calendar Windows:** The Philippine cropping cycle is mapped to three seasons:
   - Season 1: Wet Season (June – October, heavy monsoon rainfall and typhoon exposure).
   - Season 2: Cool Dry Season (November – February, residual soil moisture and moderate temperatures).
   - Season 3: Hot Dry Season (March – May, high thermal irradiance and water deficit risks).
2. **Hard Agronomic Constraints:** The engine eliminates invalid permutations:
   - *Monoculture prohibition:* No crop can follow itself in back-to-back seasons ($c_t \ne c_{t-1}$).
   - *Strict Solanaceae ban:* Consecutive Solanaceous crops (e.g., Tomato $\to$ Eggplant) are strictly forbidden to prevent the proliferation of soil-borne bacterial wilt (*Ralstonia solanacearum*) and nematodes.
   - *Grass monoculture filter:* Sequences consisting solely of grasses (Rice $\to$ Corn $\to$ Rice) without a legume or broadleaf break are prohibited.
3. **Five-Pillar Scoring Formulation (0–100 per pillar):**
   - **Soil Health:** Awards biological nitrogen fixation bonuses ($+25\text{ to }+35$ pts, fixing 35–80 kg N/ha via Mungbean, Cowpea, or Peanut) and root stratification bonuses ($+20$ pts for pairing shallow fibrous rooters like Rice with deep taproots like Cassava or Peanut).
   - **Water Resilience:** Evaluates flood tolerance against wet season rainfall (>1000 mm) and drought tolerance during the hot dry season.
   - **Climate Shock Buffer:** Evaluates crop resistance against extreme temperature days ($T_{\max} \ge 34^\circ\text{C}$) and dry-spell runs.
   - **Economic Viability:** Factors in market value tiers, input cost burdens, and staple food security (Rice/Corn).
   - **Labor Feasibility:** Balances peak labor requirements to prevent operational bottlenecks.
4. **Scenario Stress-Testing:** Sequences are tested across 5 climate shock scenarios:
   - *Baseline Climatology:* 10-year NASA POWER monthly normal.
   - *Hotter (+1.5°C):* Paris Agreement warming boundary; penalizes heat-sensitive flowering.
   - *Drier (-15% rainfall):* Strong El Niño drought simulation.
   - *Hotter + Drier Compound Shock:* Simultaneous thermal and hydrological deficit.
   - *Wetter (+15% rainfall):* Intense La Niña monsoon and repeated typhoon depressions.
   Rotations with minimal score degradation ($\le 12$ pts) and strong absolute performance ($\ge 68$) earn the **"Climate-Robust"** certification.
5. **Team-Provided Values Under Review (`needsReview: true`):**
   - Land NDVI monthly profiles in sample fixtures are synthetic demonstration curves.
   - The preliminary lowland flood screen threshold (`elevation < 30m` and `slope <= 3%` in `[LAND-RULE-FLOOD]`) carries review status.
   - The bare-field fallow threshold (`NDVI < 0.25` during March–June in `[LAND-RULE-BARE]`) carries review status.
   - The demonstrative RUSLE annual soil erosion factors (`A = R × K × LS × C × P`) are illustrative estimates requiring local ground-truthing.

---

## 📍 Pilot Coverage

AniTala is calibrated strictly for **four pilot agricultural municipalities** in the Philippines. It does **not** provide nationwide coverage.

| Pilot Municipality | Province | Region | Coordinates | Elevation | Agricultural Profile |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Science City of Muñoz** | Nueva Ecija | Central Luzon (Region III) | 15.71715° N, 120.90643° E | 58 m | National Rice Granary and PhilRice hub; heavy clay-loam plains with pronounced wet/dry seasons. |
| **City of Ilagan** | Isabela | Cagayan Valley (Region II) | 16.97500° N, 121.81000° E | 46 m | Corn and grain capital; fertile river basin alluvial soils suitable for corn-legume relay. |
| **Pototan** | Iloilo | Western Visayas (Region VI) | 10.95200° N, 122.63200° E | 22 m | Panay agricultural breadbasket; mixed rainfed/irrigated lowlands prone to El Niño dry spells. |
| **Malaybalay City** | Bukidnon | Northern Mindanao (Region X) | 8.15558° N, 125.12834° E | 620 m | High-altitude plateau with volcanic and acid upland soils; high-value vegetables and root crops. |

---

## 💻 Tech Stack

Verified directly from `package.json`:

- **UI Framework:** React 19 (`^19.3.1`) + React DOM (`^19.3.1`)
- **Language & Runtime:** TypeScript (`~7.0.2`), Node.js (v20+ recommended)
- **Bundler & Dev Server:** Vite (`^8.3.6`) with Rolldown-powered production bundling
- **CSS & Styling:** Tailwind CSS v4 (`^4.3.5`) via `@tailwindcss/vite`
- **Mapping:** Leaflet (`^1.9.4`) with NASA GIBS Tile Matrix
- **State Management:** Zustand (`^5.1.0`)
- **Data Validation:** Zod (`^4.6.7`)
- **Data Visualization:** Recharts (`^3.10.1`)
- **Icons:** Lucide React (`^1.72.0`)
- **Unit Testing:** Vitest (`^5.1.0`)
- **Linting:** Oxlint (`^1.90.0`)
- **Script Runner:** `tsx` (`^4.23.15`)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v20.x or v22.x LTS recommended)
- npm (v10+)

### Commands

```bash
# 1. Clone repository
git clone https://github.com/knet-the-traveller/Moon-Chanter.git
cd Moon-Chanter

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev
# Server starts at http://localhost:5173/

# 4. Run automated test suites (Vitest)
npm test
# Expected: 31 test files passed, 291 unit tests passed

# 5. Run linter (Oxlint)
npm run lint
# Expected: 0 warnings, 0 errors across 95 files

# 6. Build production bundle (tsc -b && vite build)
npm run build
# Compiles optimized static assets into dist/

# 7. Preview production build locally
npm run preview
# Serves dist/ at http://localhost:4173/
```

### Vercel Deployment Note
The repository is configured for deployment as a single-page Vite application at the repository root via `vercel.json` (`"framework": "vite"`, `"outputDirectory": "dist"`). The `scripts/soilgrids/` folder contains offline Python data-preprocessing tools used only during development, is excluded via `.vercelignore`, and is **never** deployed as a runtime backend service.

---

## 📁 Project Structure

```
Moon-Chanter/
├── .vercelignore               # Vercel build exclusions (scripts/soilgrids/)
├── vercel.json                 # Vercel static Vite deployment configuration
├── package.json                # Project dependencies, scripts, and tooling
├── tsconfig.json               # Root TypeScript configuration
├── public/
│   ├── images/landing/         # AniTala brand assets, hero artwork, step photos
│   └── sample-data/            # Offline fallback JSON fixtures (Muñoz, Ilagan, Pototan, Malaybalay)
├── src/
│   ├── landing/                # AniTala intro landing page components, config, and i18n
│   ├── components/             # In-app planner UI (Map, LocationPicker, Stepper, AdvisorySheet)
│   ├── engine/                 # Pure TypeScript recommendation and climate shock engine
│   ├── services/               # NASA POWER API, ISRIC SoilGrids, NASA GIBS, and cache services
│   ├── data/                   # Philippine pilot locations and crops.json agronomic database
│   ├── store/                  # Zustand global application state (useAppStore.ts)
│   ├── types/                  # Core TypeScript types, schemas, and contracts
│   ├── i18n/                   # In-app bilingual localization (English / Filipino)
│   └── tests/                  # Vitest unit test suites for engine, services, and UI
├── scripts/
│   ├── soilgrids/              # Offline Python raster data acquisition and validation ETL
│   ├── build-municipal-fixtures.ts # Fixture generation script
│   └── fetch-sample-power.ts   # Sample climate telemetry fetching utility
└── docs/                       # Technical specifications, methodology, and testing guides
```

---

## ⚠️ Limitations & Disclosures

1. **Satellite Spatial Resolution:** NASA POWER data has a 0.5° × 0.5° (~55 km) grid resolution. It accurately reflects regional seasonal baselines and decadal trends but cannot capture micro-topographical rain shadows, valley breezes, or localized convective downpours.
2. **Modeled Digital Soil Data:** ISRIC SoilGrids v2.0 represents machine-learning modeled spatial predictions at 250 m resolution. It cannot substitute for laboratory soil sampling or physical field testing. Farmers should use the built-in **Farmer Soil Override** to align pH and texture with local conditions.
3. **Illustrative Baselines:** Certain terrain screens (e.g., preliminary lowland flood screen) and synthetic NDVI curves in sample data carry `needsReview: true` metadata and require ground-truth validation by local agronomists.
4. **Decision Support, Not Yield Forecasting:** AniTala models crop rotation sequence suitability and climate resilience. It does **not** forecast absolute crop yields (e.g., cavans/hectare) or guarantee financial returns.
5. **Geographic Boundaries:** Calibrated exclusively for the four designated pilot municipalities. Users outside these pilot bounds should consult local agricultural extension officers before adopting rotation recommendations.

---

## 🖼️ Suggested Screenshots

For documentation and presentation submissions, capture and store screenshots in `docs/images/`:

1. `docs/images/01-landing-hero.png` — AniTala landing page hero section showing the terraced fields artwork, header, and search pill.
2. `docs/images/02-farm-locator-map.png` — Step 1 Farm Locator showing pilot presets and the NASA GIBS MODIS True Color satellite tile layer.
3. `docs/images/03-soil-and-priorities.png` — Step 2 displaying SoilGrids telemetry with the one-tap Farmer Soil Override and priority sliders.
4. `docs/images/04-ranked-rotation-plans.png` — Step 4 showing ranked Wet $\to$ Cool Dry $\to$ Hot Dry plans with "Climate-Robust" badges and explainability rules.
5. `docs/images/05-printable-plan.png` — Dedicated printable farm advisory sheet (`Ctrl+P` view).

---

## 🤝 Transparency, Attribution & Credits

- **Synthetic Intelligence (S.I.) Transparency:** Visual assets, UI scaffolding, and crop rotation ranking formulations were developed with Synthetic Intelligence (S.I.) assistance using open Earth observation datasets.
- **NASA Data Attribution:** This application incorporates open data courtesy of the **NASA POWER Project** (NASA Langley Research Center) and **NASA EOSDIS GIBS** (Global Imagery Browse Services).
- **Soil Data Attribution:** Digital soil property predictions courtesy of **ISRIC — World Soil Information (SoilGrids 2.0)** under Creative Commons Attribution 4.0 International (CC BY 4.0).
- **Disclaimer:** Built as an open-source educational and decision-support entry for the 2026 NASA Space Apps Challenge. This application is **not** endorsed by or affiliated with NASA.
- **Team Credits:** Team Moon Chanter ([TEAM NAMES]).

---

## 📄 License

- **Software**: Distributed under the [MIT License](LICENSE).
- **NASA Telemetry**: NASA POWER and NASA GIBS datasets are public domain open data (U.S. Government work).
- **Soil Data**: ISRIC SoilGrids 2.0 digital soil predictions are used under [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).
