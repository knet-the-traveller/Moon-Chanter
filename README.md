# 🌾 FieldShift: Adapting Farms with NASA Data

> **NASA Space Apps Challenge 2026**  
> **Challenge:** [Field Shift: Adapting Farms with NASA Data](https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/)  
> **Team:** Moon Chanter  
> **Application:** FieldShift  
> **Pilot Region:** Philippines (Central Luzon, Cagayan Valley, Western Visayas)  

---

## 🛰️ Project Overview

**FieldShift** is an explainable, mobile-first decision-support platform designed for smallholder farmers and agricultural extension workers in the Philippines. It combines **NASA Earth observation data** (NASA POWER, MODIS/VIIRS via NASA GIBS), **global soil telemetry** (ISRIC SoilGrids), and **localized agronomic knowledge** to generate, rank, and stress-test 3-season crop rotation strategies under changing climatic scenarios.

By alternating crops that replenish soil nitrogen, stratify root depths, and conserve water envelopes, FieldShift transforms space-based observations into actionable resilience on the ground.

> [!NOTE]
> FieldShift is designed as a supportive decision-exploration co-pilot—it helps identify agro-climatic patterns and rotation possibilities, but does not replace farmer judgment or local agricultural extension expertise.

---

## ✨ Key Features

1. **Interactive Farm Locator & NASA Satellite Layers**
   - Interactive Leaflet map with Philippine pilot presets (*Science City of Muñoz, Ilagan Isabela, Pototan Iloilo, Malaybalay Bukidnon*).
   - One-tap GPS geolocation for farm fields.
   - Toggleable NASA GIBS satellite overlays:
     - **MODIS Terra Corrected Reflectance (True Color)**
     - **MODIS 8-Day Vegetation Greenness (NDVI)**

2. **Real Earth Observation Telemetry**
   - **NASA POWER API integration**: 10-year monthly precipitation, average & maximum temperatures, heat stress days ($T_{\max} \ge 34^\circ\text{C}$), and decadal rainfall trends.
   - **ISRIC SoilGrids v2.0**: Automated topsoil clay, sand, silt percentages, pH, and soil organic carbon (SOC).
   - **Farmer Override System**: Allows farmers to update soil characteristics based on direct on-the-ground knowledge with one tap.

3. **Transparent, Pure TypeScript Recommendation Engine (`/src/engine`)**
   - Pure, deterministic, 100% explainable rules (no black-box ML).
   - Strictly prevents disease cycles (e.g. bans consecutive Solanaceae to break bacterial wilt *Ralstonia solanacearum*).
   - Rewards biological nitrogen fixation ($+35\text{ to }80\text{ kg N/ha}$) and root stratification.
   - Dynamic real-time weighting using farmer priority sliders (Soil Health, Water Resilience, Stable Income, Low Costs, Low Labor, Climate Risk).

4. **Climate Shock Stress-Testing**
   - Evaluates all rotations against 5 scenarios:
     - *Baseline Climatology*
     - *Hotter (+1.5°C)*
     - *Drier (-15% rainfall / El Niño)*
     - *Hotter + Drier Compound Shock*
     - *Wetter (+15% intense monsoon / typhoons)*
   - Plans that maintain rank and stability receive the **"Climate-Robust"** certification badge.

5. **Traceable Explainability & Risks**
   - Every recommended plan details 3–5 plain-language reasons with exact rule IDs (`[AGRO-RULE-01-NFIX]`) and telemetry values.
   - Flags operational risks (e.g. seedling flood damage, heat-induced flower abortion) along with farmer mitigations.

6. **Bilingual & Inclusive Design**
   - Instant language switcher between **English** and **Filipino / Tagalog** (*Pagpapalit-palit ng Pananim*, *Kalusugan ng Lupa*).
   - High sunlight contrast palette designed for outdoor smartphone use at 360px+ widths.

7. **Print-Ready Farm Advisory Sheet**
   - Dedicated print layout (`Ctrl+P` / `"Print Field Plan"`) producing a clean single-page advisory sheet for agricultural technicians and farmers.

8. **Offline Resilience & Caching**
   - 7-day persistent `localStorage` cache for API responses.
   - Pre-bundled offline fallback datasets for pilot agricultural municipalities in `/public/sample-data/`.

---

## 🛠️ Technology Stack

- **Framework:** React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS (modern, mobile-first, high sunlight outdoor contrast)
- **Mapping:** Leaflet with NASA GIBS WMTS Tile Matrix and OpenStreetMap
- **State Management:** Zustand
- **Data Validation:** Zod
- **Visualizations:** Recharts (Climatology Composed Chart)
- **Icons:** Lucide React
- **Unit Testing:** Vitest (100% test coverage across recommendation engine rules and scenarios)

---

## 🚀 Quick Start & Development

### Prerequisites
- Node.js (v18 or higher recommended; v22/v24 verified)
- npm

### Installation
```bash
# Clone the repository
git clone https://github.com/knet-the-traveller/Moon-Chanter.git
cd Moon-Chanter

# Install dependencies
npm install

# Run the local development server
npm run dev
```

### Running Unit Tests
```bash
# Run Vitest test suite for the engine
npm test
```

### Visual Testing & Verification
For visual, in-browser, and mobile-simulation testing of all interactive features (maps, NASA GIBS satellite layers, climate cards, priority sliders, and printable advisory plans), follow the:
📖 **[Local Testing & Visual Run Guide](docs/LOCAL_TESTING_GUIDE.md)**

### Building for Production
```bash
# Build optimized static bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 📊 Data Sources & References

Aligned with the official **2026 NASA Space Apps Challenge Resources**:

| Resource / Platform | Satellite / Agency | Resolution & Role in FieldShift |
|---|---|---|
| **NASA POWER API** | NASA Langley Research Center (LaRC) | 0.5° × 0.5° grid, daily & 10-year monthly climatology (`T2M`, `T2M_MAX`, `PRECTOTCORR`, `ALLSKY_SFC_SW_DWN`, `RH2M`) |
| **MODIS & VIIRS Imagery** | NASA GIBS / LP DAAC / USGS | 250m–1km optical satellite reflectance and 8-day vegetation greenness (NDVI) |
| **Landsat (30m)** | USGS / NASA | 30m multispectral optical imagery for bare-field soil erosion risk monitoring |
| **NASA SMAP** | NASA JPL / GSFC | 9km–36km surface & root-zone soil moisture anomalies for post-monsoon legume relay timing |
| **NASA GPM & IMERG** | NASA / JAXA | 0.1° precipitation rate and extreme-storm accumulation for rainfall erosivity assessment |
| **NASA SRTM** | NASA / NGA | 30m Digital Elevation Model (DEM) for lowland drainage basin and slope erosion hazard flagging |
| **NASA JPL ECOSTRESS** | NASA Jet Propulsion Laboratory | 70m Land Surface Temperature (LST) and Evaporative Stress Index (ESI) for thermal stress hotspots |
| **NASA NLDAS / GLDAS** | NASA GSFC | Land data assimilation for root-zone moisture and hydrologic sensitivity context |
| **ESA Copernicus Sentinel-2** | European Space Agency (Partner) | 10m–20m multispectral red-edge/NIR for fine-scale vegetative cover |
| **ECMWF ERA5 Reanalysis** | ECMWF / Copernicus (Partner) | 0.25° hourly/monthly reanalysis for microclimate and station gap-filling |
| **FAO GAEZ v4** | UN FAO / IIASA | Global agro-climatic crop suitability indices and agro-edaphic constraints |
| **ISRIC SoilGrids 2.0 & Baselines** | ISRIC / DA-BSWM / PhilRice | 250m topsoil physical properties (clay/sand/silt %, pH, SOC) + 1-tap **Farmer Soil Override** |
| **Philippine Crop Agronomy** | PhilRice, DA-BPI, FAO, IRRI, PCARRD | Local agronomic profiles documented in `src/data/crops.json` |

*For complete data specifications and provenance details, see [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) and [docs/METHODOLOGY.md](docs/METHODOLOGY.md).*

---

## 👥 Team Moon Chanter
- **2026 NASA Space Apps Challenge**
- Dedicated to building practical, accessible space-data applications for climate adaptation and smallholder farmers.

---

## 📄 License
This project is developed under the MIT License for the NASA Space Apps Challenge.
NASA data courtesy of the NASA POWER Project and NASA EOSDIS GIBS.
ISRIC SoilGrids data under CC BY 4.0.
