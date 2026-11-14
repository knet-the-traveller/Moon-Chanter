# FieldShift: Data Sources & Provenance Specification

> **NASA Space Apps Challenge 2024:** "Field Shift: Adapting Farms with NASA Data"  
> **Team:** Moon Chanter  
> **Application:** FieldShift  
> **Branch / Module:** `feature/dev1-climate` (Developer 1 Slice)  

---

## Overview

FieldShift relies strictly on verified, publicly documented, no-auth or easily accessible Earth observation telemetry and global physical datasets. Every data point shown in the application displays its exact **source, variable, and temporal baseline**.

---

## 1. Primary Live Climate Source: NASA POWER Daily Point API

- **Organization:** NASA Langley Research Center (LaRC)
- **Service Name:** Prediction of Worldwide Energy Resources (POWER) API
- **Endpoint Format:** `https://power.larc.nasa.gov/api/temporal/daily/point`
- **Community:** Agroclimatology (`AG`)
- **Spatial Resolution:** 0.5° × 0.5° latitude/longitude grid (~55 km at the equator)
- **Temporal Baseline:** 10 most recent complete calendar years (2014-01-01 to 2023-12-31, 3,652 daily records)
- **License / Access:** Public Domain (No API key required)

### Query Parameters

```http
GET https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,T2M_MAX,PRECTOTCORR,RH2M,ALLSKY_SFC_SW_DWN&community=AG&longitude=120.9060&latitude=15.7140&start=20140101&end=20231231&format=JSON
```

### Variables Queried

| Parameter | Full Name | Units | Application in FieldShift |
|---|---|---|---|
| `T2M` | Temperature at 2 Meters | °C | Mean annual and seasonal temperature baseline |
| `T2M_MAX` | Maximum Temperature at 2 Meters | °C | Heat stress threshold detection ($T_{\max} \ge 35.0^\circ\text{C}$) |
| `PRECTOTCORR` | Corrected Total Precipitation | mm/day | Daily, seasonal, and annual rainfall sums; dry-spell runs |
| `ALLSKY_SFC_SW_DWN` | All Sky Surface Shortwave Downward Irradiance | $\text{MJ}/\text{m}^2/\text{day}$ | Solar radiation & crop photosynthetic potential |
| `RH2M` | Relative Humidity at 2 Meters | % | Atmospheric moisture & foliar disease pressure |

### Missing-Value Fill Code Handling
- NASA POWER encodes missing values using `-999` or `-999.00`.
- In `src/services/nasaPower.ts`, any value $\le -900$, `null`, `undefined`, or `NaN` is explicitly sanitized to `null`.
- Missing days are never treated as zeros ($0\text{ mm}$ or $0^\circ\text{C}$). If any seasonal cycle has $>20\%$ missing days (`PILOT_CONFIG.thresholds.maxMissingDayFraction`), it is excluded from the multi-year seasonal average.

### Resilience & Fallback Hierarchy
1. **Tier 1 — Live API (`tier: 'live'`, `isSample: false`):**
   - 15-second timeout with `AbortController`.
   - Up to 2 retries with exponential backoff (`1000ms`, `2000ms`).
   - No retry on 4xx client errors (400, 404).
   - Successful responses are saved in the persistent cache with a 30-day TTL.
2. **Tier 2 — Cache (`tier: 'cache'`, `isSample: false`):**
   - Dual-layer storage: IndexedDB (preferred) and `localStorage` with in-memory synchronization (`src/services/cache.ts`).
   - Safe `try/catch` wrapper guaranteed to never throw into callers.
3. **Tier 3 — Bundled Sample (`tier: 'sample'`, `isSample: true`):**
   - Bundled raw NASA POWER payload at `public/sample-data/nasa-power-pilot.json` (3,652 verified records for Muñoz, Nueva Ecija).
   - Generated using `scripts/fetch-sample-power.ts`.
   - The UI and contract mark `isSample: true` only when this fallback tier is actively serving the data.

---

## 2. Derived Climate Summary & Methodology

### A. Seasonal Boundaries
- **Wet Season:** June 1 to November 30 (Months 6–11).
- **Dry Season:** December 1 to May 31 (Months 12, 1–5).
  - *Year Boundary Handling:* December of year $Y$ is grouped together with January through May of year $Y+1$ into a single cross-year dry season cycle (e.g. `2014-2015-dry`).

### B. Summary Indicators
1. **Mean Seasonal Temperature (`meanTempC`):** Arithmetic mean of valid `T2M` readings.
2. **Seasonal Rainfall Total (`rainfallMm`):** Sum of daily `PRECTOTCORR` values across each season, averaged across valid years.
3. **Rainfall Variability (`rainfallVariability`):** Inter-annual sample coefficient of variation:
   $$CV = \frac{\sigma_{\text{rainfall}}}{\mu_{\text{rainfall}}}$$
4. **Average Longest Dry Spell (`dryspellDaysAvg`):** The maximum run of consecutive days with daily precipitation $< 1.0\text{ mm}$, averaged across all valid years.
5. **Heat Stress Days (`heatStressDays`):** Average number of days per season where $T_{\max} \ge 35.0^\circ\text{C}$.
6. **10-Year Decadal Trend (`trend10y`):**
   - Linear regression slope ($m_{\text{temp}}$) across 10 years $\times 10 = \text{tempC}$ (°C/decade).
   - Linear regression slope ($m_{\text{rain}}$) across 10 years $\times 10 \div \mu_{\text{annual\_rain}} \times 100 = \text{rainfallPct}$ (% change relative to period mean).

### C. Climate Scenario Transformations & Methodological Limitation
The engine evaluates 5 sensitivity scenarios (`src/engine/climate/scenarios.ts`):
- `baseline`: Unmodified NASA POWER series.
- `hotter`: $+1.5^\circ\text{C}$ added to `T2M` and `T2M_MAX`.
- `drier`: Daily `PRECTOTCORR` multiplied by $0.85$ (15% reduction).
- `wetter`: Daily `PRECTOTCORR` multiplied by $1.15$ (15% increase).
- `hotter_drier`: Compound shock ($+1.5^\circ\text{C}$ and $0.85\times$ rainfall).

> **Important Limitation Notice:**
> Scaling daily rainfall by a constant factor alters seasonal totals and threshold crossings, but preserves rainfall occurrence frequency and the underlying dry-spell sequence lengths. Consequently, dry-spell durations under scenarios are sensitivity approximations, not dynamical weather forecasts. These are what-if sensitivity tests, not forecasts.

---

## 3. Satellite Earth Observation Imagery: NASA GIBS

- **Organization:** NASA Earth Observing System Data and Information System (EOSDIS)
- **Service Name:** Global Imagery Browse Services (GIBS)
- **Protocol:** WMTS / XYZ EPSG:3857 Tile Matrix
- **License / Access:** Public Domain / Open Data

### Tile Layers
1. **MODIS Terra Corrected Reflectance (True Color):**
   - Optical true-color satellite reflectance showing terrain and field canopy.
2. **MODIS Terra NDVI (8-Day Composite):**
   - Normalized Difference Vegetation Index indicating vegetative vigor and greenness.

---

## 4. Supplementary Soil Physical Properties: ISRIC SoilGrids 2.0

- **Organization:** International Soil Reference and Information Centre (ISRIC)
- **Endpoint:** `https://rest.isric.org/soilgrids/v2.0/properties/query`
- **Resolution:** 250m global model
- **Properties:** Clay, sand, silt %, pH ($H_2O$), and Soil Organic Carbon (SOC) at 0–15 cm root depth.

---

## 5. Local Agronomic Knowledge Base: `crops.json`

Curates 12 representative crops cultivated across the Philippine archipelago with citations from PhilRice, DA-BPI, PCARRD, and FAO.
