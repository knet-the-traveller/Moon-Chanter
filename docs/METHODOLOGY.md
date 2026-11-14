# FieldShift: Agronomic Methodology & Scoring Formulation

> **2026 NASA Space Apps Challenge:** "Field Shift: Adapting Farms with NASA Data"  
> **Team:** Moon Chanter  
> **Module Path:** `/src/engine`  

---

## 1. Core Philosophy: Transparent, Explainable Decision Support

Modern smallholder farming requires high trust. A farmer will not risk their season's livelihood on a black-box machine learning output. Therefore, FieldShift's recommendation engine is engineered as a **pure TypeScript, rule-based decision support system** where every score, recommendation, and risk warning is 100% auditable and traces back to agronomic literature and NASA telemetry.

---

## 2. Recommendation Engine Pipeline

```mermaid
flowchart TD
    In[Field Location, Soil & Climate Telemetry] --> Gen[Candidate Sequence Generation]
    Gen --> Filt[Hard Constraints Filtering]
    Filt --> Score[5-Pillar Multi-Objective Scoring]
    Score --> Weight[User Priority Weight Normalization]
    Weight --> Stress[Scenario Stress-Testing]
    Stress --> Rank[Ranking & Certification]
    Rank --> Explain[Plain-Language Explainability Synthesis]
```

### Stage 1: Candidate Permutation & Hard Constraints

A 3-season rotation sequence $(S_1 \to S_2 \to S_3)$ corresponds to the Philippine tropical monsoon calendar:
- **Season 1 ($S_1$):** Wet Season / Habagat (June – October)
- **Season 2 ($S_2$):** Cool Dry Season / Amihan (November – February)
- **Season 3 ($S_3$):** Hot Dry Season / Catch Window (March – May)

#### Hard Agronomic Constraints:
1. **Planting Window Match:** Crop must possess the designated season tag (`crop.plantingWindows.includes(season)`).
2. **Soil & Drainage Compatibility:** Crop soil texture and drainage tolerance must accommodate the field profile.
3. **Monoculture Ban:** Identical crop cannot occupy back-to-back seasons ($c_t \ne c_{t-1}$).
4. **Strict Solanaceae Ban:** Consecutive planting of Solanaceae (Tomato $\to$ Eggplant) is strictly banned to prevent the devastating build-up of *Ralstonia solanacearum* (bacterial wilt) and root-knot nematodes.
5. **Grass Monoculture Penalty:** Grass $\to$ Grass $\to$ Grass without a legume or broadleaf break is disallowed.
6. **Farmer Exclusions:** Excludes any crop toggled off by the user.

---

## 3. Multi-Pillar Scoring Model (0–100 per pillar)

Each candidate rotation sequence is evaluated across 5 agronomic and economic pillars:

### A. Soil Health ($S_{\text{soil}}$)
- **Base Score:** 30 pts.
- **Nitrogen Fixation:** $+25$ pts for 1 legume (e.g., Mungbean, Peanut, Cowpea); $+35$ pts for $\ge 2$ legumes. Fixes 35–80 kg biological N/ha.
- **Root Stratification:** $+20$ pts if sequence combines shallow fibrous rooters (Rice) with deep taproots (Cassava, Peanut, Sunn hemp). Penetrates plow pan and aerates soil.
- **Clay Soil Deep Root Bonus:** $+8$ pts if field is heavy clay and contains a deep-rooting aerator.
- **Organic Matter Restoration:** $+10$ pts if field has low SOC and includes high residue or legume cover.
- **Stover / Biomass Contribution:** $+8$ pts per high-residue crop (Corn stover, Legume biomass).
- **Botanical Family Diversity:** $+15$ pts for 3 distinct families; $+8$ pts for 2 families.

### B. Water Resilience ($S_{\text{water}}$)
- **Base Score:** 40 pts.
- **Monsoon Adaptation ($S_1$):** If NASA POWER wet season rainfall $> 1000\text{ mm}$, $+25$ pts for high flood tolerance (Rice); $-15$ pts for waterlog-sensitive crops.
- **Cool Dry Transition ($S_2$):** $+15$ pts for low or medium water demand.
- **Hot Dry Drought Defense ($S_3$):** $+25$ pts for high drought tolerance; $-20$ pts for drought-sensitive crops; $+15$ pts for low water demand.

### C. Climate Shock Buffer ($S_{\text{climate}}$)
- **Base Score:** 40 pts.
- **Extreme Heat Tolerance:** If NASA POWER records peak $T_{\max} \ge 34.0^\circ\text{C}$ in Hot Dry months, $+25$ pts for high heat-tolerant crops (Mungbean, Cowpea, Sweet Potato, Cassava); $-20$ pts for heat-sensitive crops.
- **Excess Rain Typhoon Protection:** $+20$ pts if peak wet season risk is high and $S_1$ has high flood tolerance.
- **Dry Spell Shield:** $+8$ pts per drought-hardy crop under high dry-spell risk.

### D. Economic Viability ($S_{\text{econ}}$)
- **Base Score:** 45 pts.
- **Market Value Tier:** $+14$ pts per high market tier crop (Mungbean, Peanut, Eggplant, Tomato, Rice).
- **Input Cost Burden:** $-8$ pts per high-input crop; $+8$ pts per low-input crop.
- **Staple Food Security:** $+10$ pts for presence of staple grain (Rice or Corn).

### E. Labor Feasibility ($S_{\text{labor}}$)
- **Base Score:** 50 pts.
- **Workload Smoothing:** $-12$ pts per high-labor crop; $+14$ pts per low-labor crop. Prevents simultaneous labor bottlenecks.

---

## 4. Priority Weighting & Overall Composite Score

The farmer's subjective priorities are captured through 6 sliders ($W_{\text{soil}}, W_{\text{water}}, W_{\text{climate}}, W_{\text{income}}, W_{\text{cost}}, W_{\text{labor}}$):

$$\text{Composite Score} = \frac{W_{\text{soil}} S_{\text{soil}} + W_{\text{water}} S_{\text{water}} + W_{\text{climate}} S_{\text{climate}} + (W_{\text{income}} + W_{\text{cost}}) S_{\text{econ}} + W_{\text{labor}} S_{\text{labor}}}{\sum W_k}$$

The weights normalize dynamically so moving any slider visibly and immediately shifts the plan rankings.

---

## 5. Scenario Stress-Testing Formulation

Every generated plan is tested across 5 climate conditions:

1. **Baseline:** Standard NASA POWER 10-year climatology.
2. **Hotter ($+1.5^\circ\text{C}$):** Simulates Paris Agreement warming boundary; penalizes low heat tolerance ($-9$ pts/crop).
3. **Drier ($-15\%$ seasonal rainfall):** Simulates strong El Niño; penalizes high water demand ($-8$ pts) and drought-intolerant crops ($-10$ pts).
4. **Hotter + Drier Compound Shock:** Simultaneous compound thermal and hydrological stress.
5. **Wetter ($+15\%$ intense rainfall):** Simulates intense La Niña monsoon and repeated typhoon depressions; penalizes non-flood tolerant crops in $S_1$ ($-16$ pts).

### Robustness Classification:
- **Climate-Robust:** Maximum score degradation $\le 12$ pts AND lowest scenario score $\ge 68$.
- **Moderate Resilience:** Maximum score degradation $\le 22$ pts.
- **Vulnerable to Shock:** Maximum score degradation $> 22$ pts OR lowest scenario score $< 52$.

---

## 6. Traceable Explainability Engine

Each recommendation synthesizes:
1. **Rule Tags:** Formatted with standardized IDs (e.g., `[AGRO-RULE-01-NFIX]`, `[AGRO-RULE-02-ROOT-STRAT]`, `[AGRO-RULE-03-HYDRO-ALIGN]`).
2. **Telemetry Citations:** Embeds exact measured values (e.g., *NASA POWER 10-year precipitation of 65mm in March–May*, *Soil Organic Carbon of 1.42%*).
3. **Farmer-Actionable Mitigations:** Concrete agronomic actions for every identified operational risk (e.g., *apply rice straw mulch to reduce evaporation during late April flowering*).

## Land NDVI profile and annual trend

Municipal land fixtures supply twelve January–December NDVI values. The initial profiles are synthetic demonstrations with `needsReview` metadata and no claimed satellite observation period. The monthly profile describes seasonal variation. Annual trend uses ordinary least squares on comparable annual mean observations, with calendar year as the independent variable and units of NDVI change per year. Missing observations, a single year, or repeated years produce compatibility zero with an explicit unavailable reason. The UI must display insufficient data for this state. The initial fixtures contain no annual observations.

## Preliminary lowland screen [LAND-RULE-FLOOD]

The proposed screen flags elevation below 30 meters together with slope at or below 3 percent. Both named thresholds carry `needsReview` and require local drainage/flood validation. With the initial illustrative profiles, Pototan is flagged, while Muñoz, Ilagan, and Malaybalay are unflagged. Elevation exactly 30 meters is outside the screen; slope exactly 3 percent is included. Terrain alone cannot establish river, storm, drainage, or infrastructure exposure. A technician should consult local flood information before making a field decision.

## Possible bare-field months [LAND-RULE-BARE]

A month is flagged when its NDVI is strictly below `BARE_FIELD_NDVI_THRESHOLD = 0.25` and it is within `FALLOW_WINDOW_MONTHS = [3, 4, 5, 6]`. Both assumptions have `needsReview` metadata for regional crop-calendar and imagery validation. Output months are unique, sorted, and one-based. Low NDVI can reflect several surface and observation conditions, so each flag requires local verification.

## Illustrative annual erosion [LAND-RULE-RUSLE]

The calculation uses `A = R × K × LS × C × P`. R represents rainfall erosivity, K soil erodibility, LS slope length/steepness, C cover/management, and P support practices. This factor structure and its sheet/rill process scope follow USDA guidance. [USDA NRCS user guide](https://www.nrcs.usda.gov/sites/default/files/2022-10/RUSLE2_NRCS_Guide_April_2017_0.pdf)

Fixtures explicitly use SI units for R (`MJ mm ha-1 h-1 yr-1`) and K (`t ha h ha-1 MJ-1 mm-1`), with dimensionless LS, C, and P, yielding metric tonnes per hectare per year. The estimate is rounded to one decimal. Negative/nonfinite factors, incompatible unit declarations, and numeric overflow are rejected.

`coverFactorFromNdvi` uses the illustrative mapping `C = (1 − max(0, mean annual NDVI))²`, bounded between zero and one for NDVI in [-1, 1]. Increasing NDVI produces an equal or smaller C. The exponent 2 and this entire mapping carry `needsReview`; they require calibration with local management and erosion observations. This application implements a simplified factor calculation. The full NRCS model includes additional process and management treatment. The result addresses rainfall-driven sheet/rill processes. Municipal synthetic inputs, unresolved soil factors, gullies, channel erosion, and mass movement limit its application to field decisions. [USDA NRCS model overview](https://www.nrcs.usda.gov/resources/tech-tools/water-erosion-rusle2)

### Land assumptions requiring verification

- Existing preset elevations, new slope values, all monthly NDVI values, and R/K/LS/P values in the demonstration fixtures.
- The 30-meter and 3-percent terrain-screen thresholds.
- The NDVI threshold of 0.25 and the March–June fallow window.
- The NDVI-to-C mapping and its exponent of 2.
- Product resolutions, observation periods, and comparable annual NDVI observations, which remain unavailable in the synthetic fixtures.

Every derived land summary propagates the fixture's sample/synthetic status and review notes. No severity bands are assigned to the erosion estimate.
