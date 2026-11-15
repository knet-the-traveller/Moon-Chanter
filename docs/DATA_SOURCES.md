# FieldShift: Data Sources & Provenance Specification

> **2026 NASA Space Apps Challenge:** "Field Shift: Adapting Farms with NASA Data"  
> **Team:** Moon Chanter  
> **Application:** FieldShift  
> **Challenge Track:** [Field Shift: Adapting Farms with NASA Data](https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/)  

---

## Overview

FieldShift relies strictly on verified, publicly documented, open-access Earth observation telemetry, space agency resources, and global agro-ecological datasets. Every indicator, score, and advisory card shown in the application displays its exact **source, variable, spatial resolution, and temporal baseline**.

---

## 🛰️ Complete 2026 NASA & Space Agency Partner Resources Matrix

The table below aligns FieldShift with the official **2026 NASA Space Apps Challenge Resources**:

| Dataset / Resource | Official 2026 Challenge URL | Spatial & Temporal Resolution | Role & Application in FieldShift |
| :--- | :--- | :--- | :--- |
| **NASA POWER** (Agroclimatology & Meteorology) | [power.larc.nasa.gov](https://power.larc.nasa.gov/) | $0.5^\circ \times 0.5^\circ$ grid, daily & 10-year monthly climatology | Primary live climate engine: precipitation (`PRECTOTCORR`), solar radiation (`ALLSKY_SFC_SW_DWN`), mean/max temperatures (`T2M`, `T2M_MAX`), heat stress days ($\ge 34.0^\circ\text{C}$), and rice spikelet sterility risk ($> 35^\circ\text{C}$). |
| **MODIS / VIIRS** & **Landsat** (via **NASA GIBS** & **LP DAAC**) | [lpdaac.usgs.gov](https://lpdaac.usgs.gov/products/) \| [earthdata.nasa.gov (VIIRS)](https://search.earthdata.nasa.gov/search?q=VIIRS) \| [earthexplorer.usgs.gov](https://earthexplorer.usgs.gov/) | $250\text{ m--}1\text{ km}$ MODIS/VIIRS & $30\text{ m}$ Landsat reflectance | Live interactive WMTS map overlays: True Color optical reflectance, seasonal crop vigor (8-day NDVI), and bare-field post-harvest soil erosion vulnerability detection ($\text{NDVI} < 0.25$). |
| **NASA SMAP** (Soil Moisture Active Passive) | [earthdata.nasa.gov/smap](https://www.earthdata.nasa.gov/data/platforms/space-based-platforms/smap) | $9\text{ km--}36\text{ km}$, 2–3 day revisit | Surface and root-zone soil moisture anomaly indicators: identifies post-monsoon residual soil moisture for relay legumes (Mungbean/Cowpea) and early warning of tail-end canal irrigation drought deficits (Feb–Apr). |
| **NASA GPM & IMERG** (Global Precipitation Measurement) | [gpm.nasa.gov/data](https://gpm.nasa.gov/data) | $0.1^\circ$ ($\approx 10\text{ km}$), half-hourly / daily | High-resolution precipitation rate and extreme-storm accumulation tracking: validates monsoon onset reliability and informs the RUSLE rainfall erosivity factor ($R$) during typhoon season. |
| **NASA SRTM** (Shuttle Radar Topography Mission) | [earthdata.nasa.gov/srtm](https://www.earthdata.nasa.gov/data/instruments/srtm) | $30\text{ m}$ Digital Elevation Model (DEM) | Digital elevation and field slope angle: flags lowland flood-prone drainage basins ($< 2\%$ slope) and upland water-erosion hazard zones ($LS$ factor on $> 18\%$ slopes). |
| **NASA JPL ECOSTRESS** | [ecostress.jpl.nasa.gov](https://ecostress.jpl.nasa.gov/data) | $70\text{ m}$, variable revisit | Land Surface Temperature (LST) and Evaporative Stress Index (ESI): pinpoints agricultural canopy heat stress hotspots and validates crop evapotranspiration water-demand differences. |
| **NASA NLDAS / GLDAS** | [earthdata.nasa.gov (LDAS)](https://www.earthdata.nasa.gov/) | $0.125^\circ \text{ to } 0.25^\circ$, sub-daily/monthly | Land Data Assimilation System root-zone soil moisture and surface runoff modeling for multi-decadal hydrologic sensitivity benchmarking. |
| **FAO GAEZ v4** (Global Agro-Ecological Zones) | [gaez.fao.org](https://gaez.fao.org/) | 5 arc-minute global grid | Global agro-climatic crop suitability indices, agro-edaphic yield potentials, and crop cycle length constraints. |
| **ESA Copernicus Sentinel-2** *(Space Agency Partner)* | [dataspace.copernicus.eu](https://dataspace.copernicus.eu/) | $10\text{ m--}20\text{ m}$, 5-day revisit | High-resolution optical red-edge, NIR, and SWIR imagery: complements Landsat/MODIS for field-scale crop cover monitoring and bare-soil exposure mapping. |
| **ECMWF ERA5 Reanalysis** *(Space Agency Partner)* | [cds.climate.copernicus.eu](https://cds.climate.copernicus.eu/) | $0.25^\circ$ ($\approx 31\text{ km}$), hourly to monthly | Global atmospheric and surface meteorological reanalysis: serves as gap-filling climatology for localized microclimates where surface weather stations are sparse. |
| **ISRIC SoilGrids 2.0** | [Public raster access](https://files.isric.org/soilgrids/latest/data/) | 250 m soil-model predictions; observation period unavailable | Separate native pilot extracts for pH, fractions, SOC and bulk density, with per-depth uncertainty. [Implementation, license and limits](SOILGRIDS_PILOT_MILESTONE.md). Municipal examples remain separate; these are not live field measurements. |

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
2. **Cumulative Seasonal Rainfall (`totalPrecipMm`):** Sum of valid `PRECTOTCORR` readings.
3. **Maximum Consecutive Dry Days (`maxConsecutiveDryDays`):** Longest run of consecutive calendar days where $\text{PRECTOTCORR} < 1.0\text{ mm}$.
4. **Heat Stress Days (`heatStressDays`):** Count of days where $T_{\max} \ge 35.0^\circ\text{C}$.

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

- **Provider and reuse:** ISRIC — World Soil Information, CC BY 4.0 with attribution. [Provider access/license statement](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html).
- **Pilot source:** versioned original-raster extracts, native 250 m cells, two depths and per-depth mean/Q05/Q95. Retrieval date is not an observation date.
- **Coverage:** small 2.25 × 2.25 km grids at four presets. Masked cells remain unavailable; data are not copied to arbitrary distant fields.
- **Outside packaged coverage:** existing validated API cache/request and explicitly labeled municipal examples. The provider reports its REST service paused; no claim of reliable live soil telemetry.
- **Interpretation:** SOC does not establish organic matter; drainage and subsoil compaction require field evidence. See [the milestone record](SOILGRIDS_PILOT_MILESTONE.md) for units, methods, source artifacts, reproducibility and remaining gaps.

---

## 5. Local Agronomic Knowledge Base: `crops.json`

Curates 12 representative crops cultivated across the Philippine archipelago with citations from PhilRice, DA-BPI, PCARRD, and FAO.


## Versioned real pilot sources (15 November 2026)

TERRAIN-01 SRTM, VEG-01 scientific MOD13Q1.061 and calculated CLIMATE-01 POWER now complement the SoilGrids package. They have explicit small-area/point coverage, source archives/checksums and missing-data/QA rules. They do not replace GIBS display imagery or the immutable demonstration fixtures. POWER retains the historical 2014–2023 baseline; SRTM is from February 2000 and MODIS from 2020–2024. Flood susceptibility, quantitative erosion and unsupported NDVI trends remain unavailable. Exact units, retrieval metadata, source reuse and verification are in [the real-source milestone](REAL_SOURCE_INTEGRATION_MILESTONE.md).
