# FieldShift: Data Sources & Provenance Specification

> **NASA Space Apps Challenge 2024:** "Field Shift: Adapting Farms with NASA Data"  
> **Team:** Moon Chanter  
> **Application:** FieldShift  

---

## Overview

FieldShift relies strictly on verified, publicly documented, no-auth or easily accessible Earth observation telemetry and global physical datasets. Every data point shown in the application displays its exact **source, variable, and temporal baseline**.

---

## 1. Primary Live Climate Source: NASA POWER API

- **Organization:** NASA Langley Research Center (LaRC)
- **Service Name:** Prediction of Worldwide Energy Resources (POWER) API
- **Endpoint Format:** `https://power.larc.nasa.gov/api/temporal/climatology/point` & `https://power.larc.nasa.gov/api/temporal/daily/point`
- **Community:** Agroclimatology (`AG`)
- **Spatial Resolution:** 0.5° × 0.5° latitude/longitude grid (~55 km at the equator)
- **Temporal Baseline:** Multi-decadal climatology (1984–2023 long-term baseline; 2013–2023 10-year rolling climatology)
- **License / Access:** Public Domain (No API key required)

### Variables Queried

| Parameter | Full Name | Units | Application in FieldShift |
|---|---|---|---|
| `T2M` | Temperature at 2 Meters | °C | Mean annual and seasonal temperature baseline |
| `T2M_MAX` | Maximum Temperature at 2 Meters | °C | Heat stress threshold detection ($T_{\max} > 34.0^\circ\text{C}$) |
| `T2M_MIN` | Minimum Temperature at 2 Meters | °C | Diurnal temperature range & cool-dry season limits |
| `PRECTOTCORR` | Corrected Total Precipitation | mm/day $\to$ mm/month | Monthly & seasonal rainfall envelopes, dry spell detection |
| `ALLSKY_SFC_SW_DWN` | All Sky Surface Shortwave Downward Irradiance | $\text{MJ}/\text{m}^2/\text{day}$ | Solar radiation & crop photosynthetic potential |
| `RH2M` | Relative Humidity at 2 Meters | % | Disease susceptibility (fungal / bacterial pressure) |

### Derived Agro-Climatic Indicators
1. **Seasonal Rainfall Totals:**
   - Wet Season (Habagat, Jun–Nov)
   - Cool Dry Season (Amihan, Dec–Feb)
   - Hot Dry Season (Mar–May)
2. **Heat Stress Days Per Year:** Count of months where $T_{\max} \ge 34.5^\circ\text{C}$ multiplied by critical flowering days.
3. **Dry Spell Vulnerability:** Ratio of Hot Dry rainfall to baseline crop evapotranspiration demand ($< 200\text{ mm}$ triggers high risk).
4. **Decadal Trend:** 10-year precipitation trajectory percentage delta ($\Delta\%$).

---

## 2. Satellite Earth Observation Imagery: NASA GIBS

- **Organization:** NASA Earth Observing System Data and Information System (EOSDIS)
- **Service Name:** Global Imagery Browse Services (GIBS)
- **Protocol:** WMTS / XYZ EPSG:3857 Tile Matrix
- **License / Access:** Public Domain / Open Data

### Tile Layers Implemented

1. **MODIS Terra Corrected Reflectance (True Color):**
   - Tile URL: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`
   - Purpose: Real optical satellite imagery showing terrain, water bodies, and vegetation canopy.
2. **MODIS Terra NDVI (8-Day Composite):**
   - Tile URL: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png`
   - Purpose: Normalized Difference Vegetation Index indicating crop health and greenness (dark green = vigorous canopy; yellow/brown = bare/fallow soil).

---

## 3. Supplementary Soil Physical Properties: ISRIC SoilGrids 2.0

- **Organization:** International Soil Reference and Information Centre (ISRIC) - World Soil Information
- **Endpoint:** `https://rest.isric.org/soilgrids/v2.0/properties/query`
- **Spatial Resolution:** 250-meter global machine learning model
- **Depths Sampled:** 0–5 cm and 5–15 cm (topsoil root zone mean)
- **License:** CC BY 4.0

### Properties Retrieved

| Property | Description | Original Unit | FieldShift Conversion |
|---|---|---|---|
| `clay` | Clay content (< 2 µm) | g/kg | Converted to % ($\div 10$) |
| `sand` | Sand content (> 50 µm) | g/kg | Converted to % ($\div 10$) |
| `silt` | Silt content (2–50 µm) | g/kg | Converted to % ($\div 10$) |
| `phh2o` | Soil pH in $H_2O$ | $\text{pH} \times 10$ | Converted to standard pH scale ($\div 10$) |
| `soc` | Soil Organic Carbon | dg/kg | Low ($<1\%$), Medium ($1–2.5\%$), High ($>2.5\%$) |

*Note: In accordance with smallholder reality, farmers can override any automated soil classification with a single click.*

---

## 4. Local Agronomic Knowledge Base: `crops.json`

FieldShift curates 12 representative crops cultivated across the Philippine archipelago:
- **Lowland Rice (*Palay*)**, **Corn / Maize (*Mais*)**, **Mungbean (*Munggo*)**, **Peanut (*Mani*)**, **Sweet Potato (*Kamote*)**, **Eggplant (*Talong*)**, **Cassava (*Kamoteng Kahoy*)**, **Cowpea (*Paayap*)**, **Soybean (*Soya*)**, **Tomato (*Kamatis*)**, **Bitter Gourd (*Ampalaya*)**, and **Sunn Hemp (*Cover Legume*)**.

### Citations & Authorities
- Philippine Rice Research Institute (PhilRice) PalayCheck System
- Department of Agriculture - Bureau of Plant Industry (DA-BPI) Production Guides
- Department of Agriculture - Bureau of Agricultural Research (DA-BAR)
- DOST - PCAARRD Commodity Technical Bulletins
- Food and Agriculture Organization (FAO) Crop Water Information Database
- International Potato Center (CIP) & AVRDC Tropical Legumes Compendium

---

## 5. Offline Resiliency & Caching Architecture

1. **Persistent Cache (`src/services/cache.ts`):** All API responses are stored in `localStorage` with a 7-day TTL.
2. **6.5s Fetch Timeout:** Built-in `AbortController` handles slow 2G/3G connectivity typical in rural farm settings.
3. **Bundled Fallback Datasets (`/public/sample-data/`):**
   - `munoz.json`: Science City of Muñoz, Nueva Ecija (Central Luzon)
   - `ilagan.json`: Ilagan City, Isabela (Cagayan Valley)
   - `pototan.json`: Pototan, Iloilo (Western Visayas)
4. **Visual Data Provenance:** When fallback data is used, an amber `"Using verified local sample data"` badge is prominently displayed.
