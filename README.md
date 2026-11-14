# 🌾 FieldShift: Adapting Farms with NASA Data

> **NASA Space Apps Challenge 2024**  
> **Challenge:** [Field Shift: Adapting Farms with NASA Data](https://www.spaceappschallenge.org/)  
> **Team:** Moon Chanter  
> **Application:** FieldShift  
> **Pilot Region:** Philippines (Central Luzon, Cagayan Valley, Western Visayas)  

---

## 🛰️ Project Overview

**FieldShift** is an explainable, mobile-first decision-support platform designed for smallholder farmers and agricultural extension workers in the Philippines. It combines **NASA Earth observation data** (NASA POWER, MODIS/VIIRS via NASA GIBS), **global soil telemetry** (ISRIC SoilGrids), and **localized agronomic knowledge** to generate, rank, and stress-test 3-season crop rotation strategies under changing climatic scenarios.

By alternating crops that replenish soil nitrogen, stratify root depths, and conserve water envelopes, FieldShift transforms space-based observations into actionable resilience on the ground.

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
git clone https://github.com/moon-chanter/fieldshift.git
cd fieldshift

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

### Building for Production
```bash
# Build optimized static bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 📊 Data Sources & References

| Need | Source | Resolution & Notes |
|---|---|---|
| Temperature, Rainfall, Solar Insolation, Humidity | **NASA POWER API** (`power.larc.nasa.gov`) | 0.5° × 0.5° grid, multi-decadal climatology |
| Optical Satellite Imagery & NDVI Greenness | **NASA GIBS** (EOSDIS) | MODIS Terra & VIIRS global tile layers |
| Soil Texture, pH, Organic Carbon | **ISRIC SoilGrids 2.0** | 250m global telemetry at 0–15cm root depth |
| Philippine Crop Agronomy & Rotations | PhilRice, DA-BPI, FAO, IRRI, PCARRD | Documented in `src/data/crops.json` |

*For complete details, see [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) and [docs/METHODOLOGY.md](docs/METHODOLOGY.md).*

---

## 👥 Team Moon Chanter
- **NASA Space Apps Challenge 2024**
- Dedicated to building practical, accessible space-data applications for climate adaptation and smallholder farmers.

---

## 📄 License
This project is developed under the MIT License for the NASA Space Apps Challenge.
NASA data courtesy of the NASA POWER Project and NASA EOSDIS GIBS.
ISRIC SoilGrids data under CC BY 4.0.
