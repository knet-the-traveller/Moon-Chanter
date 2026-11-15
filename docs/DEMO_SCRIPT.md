# FieldShift: 3-Minute Demo Script

> **2026 NASA Space Apps Challenge:** "Field Shift: Adapting Farms with NASA Data"  
> **Team:** Moon Chanter  
> **App:** FieldShift  

---

## 🎬 3-Minute Presentation Walkthrough

### Act 1: The Problem (0:00 – 0:40)
> *"Across the Philippines and Southeast Asia, smallholder farmers face a twin crisis: degrading soils from decades of monocropping, and unpredictable climate extremes from El Niño droughts to intense monsoon floods.*
>
> *While NASA collects billions of gigabytes of Earth observation data, almost none of it reaches the smallholder farmer in an actionable way. Farmers and local agricultural extension workers don't need raw satellite files—they need decision support: **'What should I plant next season that keeps my soil healthy and survives if it doesn't rain?'**
>
> *This is **FieldShift**—built by team Moon Chanter."*

---

### Act 2: Step 1 & 2 — Locating the Farm & NASA Telemetry (0:40 – 1:30)
1. **Show the Map:**
   - Tap **"Science City of Muñoz, Nueva Ecija"** (the national rice capital).
   - Toggle the satellite layers: switch from standard map to **NASA GIBS True Color (MODIS)** and **NASA GIBS Vegetation Greenness (NDVI)**. Show the real satellite reflectance and local terrain/SRTM panel.
2. **Review Telemetry:**
   - Click **"Confirm & Analyze Field"**.
   - Show the **NASA Climate Card**:
     - NASA POWER climatology: annual precipitation, heat-stress days (`Tmax ≥ 35°C`), and 10-year trend, with full provenance (`source | variable | resolution | observation period`).
   - Show the **Soil Card**:
     - Point out the bundled 250 m **ISRIC SoilGrids 2.0** extract: because Town Hall center cell #41 is masked (urban/built-up), FieldShift transparently discloses stepping ~250 m to nearest valid agricultural cell #32 (clay texture, pH 6.4, Q05/Q95 prediction uncertainty bounds), with Van Bemmelen `OM% = SOC% × 1.724` and SRTM-adjusted preliminary drainage clearly marked provisional for local confirmation.
     - Demonstrate farmer control: click the 1-click **"Use Municipal Agricultural Baseline"** button (or **"Return to SoilGrids data"**) and tap a **1-button Farmer Soil Override** to reflect actual field pH/texture/drainage.

---

### Act 3: Step 3 & 4 — Priorities, Baseline Comparison & Explainable Rotations (1:30 – 2:20)
1. **Field History & Priority Sliders:**
   - Keep recent crop at **Lowland Rice**.
   - Adjust **Soil Health**, **Water Resilience**, and **Climate Shock Buffer** sliders cleanly.
   - Click **"Generate & Rank Rotation Plans"**.
2. **Review Recommended Rotations vs. Existing Practice:**
   - Point first to **Strategy 1 — Existing Baseline: Continuous Double Rice → Bare Fallow** alongside diversified plans such as **Wet Rice → Pag-asa Mungbean → Dry Yellow Corn** and **Wet Rice → Bulb Onion → Pre-Rice Mungbean**.
   - Expand **"Why this plan?"** and **"Risks & Field Mitigations"**:
     - Highlight auditable Rule IDs: `[AGRO-RULE-01-NFIX]` (mungbean nitrogen fixation and short-cycle water savings), `[AGRO-RULE-02-HEAT35]` (>35°C April 10 – May 30 dry-season rice sterility cliff), and `[AGRO-RULE-03-PESTBREAK]` (breaking pest/disease carry-over).
     - Show the **Information Gaps & Local Review Checklist** disclosing sample/synthetic assumptions and prompting local technician verification (canal turnouts, plow-pan test, local buyer prices).

---

### Act 4: Provisional Sensitivity Scenarios, Filipino Language & Field Export (2:20 – 3:00)
1. **Provisional Sensitivity Testing:**
   - Click **"Drier (-15% Rain)"** or **"Hotter + Drier Shock"** in the scenario bar.
   - Explain clearly that these are rule-based sensitivity comparisons (explicitly marked **"Provisional plan"**, not deterministic weather forecasts or scientific certifications), comparing how the legume-relay sequence buffers soil health and water stress relative to continuous monoculture.
2. **Local Inclusivity:**
   - Toggle the language switcher to **FIL (Filipino / Tagalog)**:
     - Show how all labels, soil disclosures, agronomic reasons, and local review items switch seamlessly into clear agricultural Tagalog (*"Pagpapalit-palit ng Pananim"*, *"Kalusugan ng Lupa"*).
3. **Closing & Print View:**
   - Click **"Print Plan Sheet"** (`Ctrl+P`) to reveal the single-page printable advisory sheet, ready for municipal extension workers and farmers to verify and take into the field.
   - *"FieldShift turns open NASA Earth observations and local soil science into transparent, smallholder-ready decision support. Thank you!"*
