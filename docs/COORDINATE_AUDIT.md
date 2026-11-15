# Coordinate Audit & SoilGrids Relocation Milestone (FieldShift)

**Date**: 2026-11-15  
**Author**: Developer 1 (Climate, Scenarios & Multi-Sensor Fixtures)  
**Branch**: `dev1-climate-update`  
**Purpose**: Diagnose the Muñoz SoilGrids urban NoData deadlock, audit all 4 municipal presets, relocate coordinates to valid non-null pixels, and document scientific review and provenance flags.

---

## 1. Executive Summary

In ISRIC SoilGrids 2.0 (250 m native resolution), urban built-up areas (poblacion centers) are masked with `null` across all soil properties (`clay`, `sand`, `silt`, `phh2o`, `soc`, `bdod`). When FieldShift previously queried the default poblacion coordinates for Science City of Muñoz (`15.714, 120.906`) and Malaybalay City (`8.156, 125.127`), both points fell directly onto **Cell Index 40** (the center pixel of their 9×9 extracts), causing a NoData deadlock where recommendations could not be computed.

This audit:
1. Relocates default coordinates for **Muñoz** and **Malaybalay** to the nearest 100% complete SoilGrids pixels inside each municipality.
2. Hardens the resolution service (`src/services/bundledSoilGrids.ts` and `src/services/soilGrids.ts`) with an automatic nearest-valid-cell fallback ($\le 1.5\text{ km}$) and `modelEvidence.relocatedFrom` metadata to guarantee that NoData pixels never deadlock the application.
3. Surfaces a visible relocation advisory note to users.
4. Marks all land-cover verification statuses as `landCoverVerified: false` pending satellite/technician ground-truthing.
5. Documents the agronomic discrepancy between the SoilGrids model prediction and team baselines in Malaybalay.

---

## 2. Municipal Preset Audit Table

| Preset ID | Preset Name | Old Coordinates (Lat, Lon) | SoilGrids Cell (Old) | Old Cell Status | New Coordinates (Lat, Lon) | SoilGrids Cell (New) | Distance Moved | Land-Cover Verification | Audit Date |
|---|---|---|---|---|---|---|---|---|---|
| `munoz` | Science City of Muñoz, Nueva Ecija | `15.71400, 120.90600` | 40 | **ALL NULL (NoData)** | **`15.71715, 120.90643`** | 31 | 0.35 km N | `landCoverVerified: false` (candidate within municipality) | 2026-11-15 |
| `bukidnon` | Malaybalay City, Bukidnon | `8.15600, 125.12700` | 40 | **ALL NULL (NoData)** | **`8.15558, 125.12834`** | 41 | 0.15 km E | `landCoverVerified: false` (candidate within municipality) | 2026-11-15 |
| `ilagan` | City of Ilagan, Isabela | `16.97500, 121.81000` | 40 | Complete (Non-null) | `16.97500, 121.81000` (retained) | 40 | 0.00 km | `landCoverVerified: false` | 2026-11-15 |
| `pototan` | Pototan, Iloilo | `10.95200, 122.63200` | 40 | Complete (Non-null) | `10.95200, 122.63200` (retained) | 40 | 0.00 km | `landCoverVerified: false` | 2026-11-15 |

---

## 3. Soil Properties at Relocated Coordinates (0–15 cm Thickness-Weighted Mean)

| Preset | Cell Index | pH (H₂O) | Texture Class | Clay (%) | Sand (%) | Silt (%) | SOC (dg/kg) | Bulk Density (g/cm³) | Status across all depths |
|---|---|---|---|---|---|---|---|---|---|
| **Muñoz** | 31 | 6.4 | `clay` | 38.1 | 28.3 | 33.6 | 151.0 | 1.41 | 100% complete |
| **Malaybalay** | 41 | 5.5 | `clay` | 39.6 | 24.1 | 36.3 | 282.0 | 1.25 | 100% complete |
| **Ilagan** | 40 | 5.6 | `clay` | 39.3 | 31.6 | 29.1 | 438.0 | 1.29 | 100% complete |
| **Pototan** | 40 | 5.7 | `clay_loam` | 36.2 | 28.0 | 35.8 | 239.3 | 1.43 | 100% complete |

---

## 4. Malaybalay Agronomic Soil Discrepancy Flag

> [!WARNING]
> **Agronomic Discrepancy Notice for Malaybalay City, Bukidnon**:
> * **ISRIC SoilGrids 2.0 Model Prediction (Cell 41)**: Predicts **pH 5.5** (moderately acidic), with bulk density of $1.25\text{ g/cm}^3$ and SOC of $282\text{ dg/kg}$.
> * **Team Agronomic Baselines**: Report **pH 4.5–4.8** (strongly to extremely acidic highland volcanic Ultisols/Andosols) with severe phosphorus fixation ($104\text{–}170\text{ mg P/100g}$).
> * **Handling Policy**: These two datasets are kept in **strictly separate, unmerged blocks** in `public/sample-data/malaybalay.json`:
>   - `soil` contains the model prediction from SoilGrids 2.0.
>   - `teamBaselines` contains the team-provided agronomic benchmark with `"provenance": "team-provided"` and `"needsReview": true`.
>   - **Neither dataset is averaged, substituted, or combined into the other.** Local soil sampling and ground-truthing by DA-PhilFIDA / BSWM technicians must verify pH and P-retention before either is utilized for binding crop suitability scores.

---

## 5. NASA POWER Coarse Grid & Cache Validity

* **Spatial Resolution**: NASA POWER has a native grid of $0.5^\circ \text{ latitude} \times 0.625^\circ \text{ longitude}$ (~55 km). The shifts of 0.35 km in Muñoz and 0.15 km in Malaybalay fall squarely within the exact same satellite grid cell as the municipal poblacion.
* **Cache Key Integrity**: `climateCacheKey` generates strings formatted as `nasa_power_observed_v3_${lat}_${lon}`. Relocating coordinates initiates fresh, clean cache entries without stale cache collision.
* **Bundled Fallback Alignment**: `getNearestSampleSlug` uses distance thresholds ($< 2.5^\circ$) that continue to correctly associate the relocated coordinates with their corresponding offline pilot payloads.

---

## 6. Land-Cover Verification Policy

No bundled raster land-cover dataset is bundled in this repository. In compliance with data honesty guidelines:
* All land cover designations in this document and in municipal fixtures carry `landCoverVerified: false`.
* Unverified geographic generalizations (e.g., claiming specific agricultural institutions or field boundaries) have been excluded.
* True cropland verification requires visual confirmation on high-resolution optical imagery (e.g., Sentinel-2 or Landsat 8/9 true-color surface reflectance) or local extension worker field surveys.
