# Real pilot sources and data-integrity milestone

Agent: Codex (GPT-6). Review stop: 15 November 2026.
Branch `dev2/soil-source-integration`; base `b097a7f6684856e3ff0a87157e81131c747f9200` (merged PR 9). Remote fetch shows HEAD and origin/main at that same base; the implementation remains uncommitted. No push, merge or new ticket implementation was performed.

This finishes the first source-integration group from [the resource catalog](DATA_GAP_RESOURCE_CATALOG.md): SOIL-01, TERRAIN-01, VEG-01 and calculated CLIMATE-01. The earlier [SoilGrids milestone](SOILGRIDS_PILOT_MILESTONE.md) describes the soil portion. This is additional authorized source work before the original numbered Ticket 10; it does not complete Tickets 10–13. Economics, GPM, parcel flood modelling, erosion calibration, land cover and HLS are later scoped work.

## Changes and actual coverage

- **Soil:** retained the separately versioned native 250 m SoilGrids extracts and per-depth uncertainty. Exact Muñoz/Malaybalay soil cells remain masked. Drainage and organic matter need field inputs; required missing inputs pause ranking. Original references/preset coordinates/crop profiles remain unchanged.
- **Terrain:** four 35 × 35 native SRTM posts with a one-post halo; usable lookup is 33 × 33 posts, approximately 1 km around each existing preset. Nearest-post elevation and Horn 3 × 3 percent slope use local WGS84 metric spacing. Values apply only inside this extract. Halo/NoData cannot generate a slope. Acquired SRTM slope feeds existing soil-based rules, whichever land/soil request finishes first; missing real slope removes a legacy slope substitute. No new scoring weights or terrain thresholds.
- **Scientific vegetation:** the supplied AppEEARS MOD13Q1.061 export contains 464 already-scaled observations with detailed QA and pixel reliability. Its extra 19 December 2019 composite is retained in source evidence but excluded from 2020–2024 statistics (115 composites per point). The extracted point coordinates alone are supported; no unverified pixel polygon or nearby-farm substitution is invented. GIBS remains a separate visualization and does not supply these numerical values.
- **Climate:** four fresh public POWER requests retain six variables, including actual T2M_MIN, over the existing 2014–2023 historical baseline. Exact acquired points resolve offline; custom points use validated seven-day cache → bounded live request → explicitly labeled Muñoz reference. The requested baseline is historical, not current weather. Derived caches use a new version namespace and exact coordinate keys. Raw cache envelopes preserve retrieval timestamps and prevent duplicate live requests.

## NDVI QA and statistical limits

The [Collection 6.1 user guide](https://lpdaac.usgs.gov/documents/621/MOD13_User_Guide_V61.pdf), tables 1, 4 and 5, defines scale, fill and QA. The AppEEARS README states its CSV is already scaled; multiplying by 0.0001 again would be an error. Scaled fill is null, never vegetation. Dates identify the composite start, not an exact acquisition day.

The conservative `conservative-land-v1` policy requires reliability 0, MODLAND 0, VI usefulness ≤2, non-high aerosol, no adjacent/mixed cloud, land-only mask 1, no snow/ice or shadow. This project policy needs local scientific review; it is not NASA's universal mandatory filter. Marginal or water-mixed pixels are not reclassified to create more results. Monthly means need at least three accepted composites from at least two years. They group by composite start month and remain subject to clear-sky/seasonal sampling bias. There is no interpolation. Source counts and raw rows are retained.

| Reference | Accepted / 115 | Monthly result | Annual trend |
| --- | --- | --- | --- |
| Science City of Muñoz | 77 | 10 months supported; July/August unavailable | Unavailable |
| Ilagan | 0 | Unavailable: the pixel's QA identifies shoreline/shallow water | Unavailable |
| Pototan | 16 | All months below the minimum evidence requirement | Unavailable |
| Malaybalay (`bukidnon`) | 44 | 8 months supported | Unavailable |

Trend requires five annual profiles, each covering all 12 months with at least 16 accepted composites. Annual means balance calendar-month means, then fit OLS against actual years. None of these four points qualifies. Zero remains the legacy numeric compatibility sentinel with `trendAvailable=false`; UI displays unavailable, never a false zero slope. Bare-field classification and RUSLE erosion remain unavailable: a low NDVI is not proof of bare soil, soil degradation, crop identity or an erosion rate.

## Climate calculations and bug fixes

The public [POWER documentation](https://power.larc.nasa.gov/docs/tutorials/service-data-request/api/) identifies the coarse meteorological and solar grids. These are regional gridded estimates, not field sensors. Radiation is 1° × 1° for this baseline; meteorology is 0.5° latitude × 0.625° longitude.

Profiles require at least three complete calendar years for T2M, Tmax and rain and at least one complete cross-year dry season. Missing core days exclude a year rather than creating numeric defaults or scaled partial totals. Humidity/radiation need ≥80% valid monthly coverage; otherwise the service uses an explicitly labeled whole-reference fallback. Minimum temperature uses actual T2M_MIN means or null, never T2M minus five degrees. Calendar gaps become nulls; nonfinite/fill values, negative rainfall/radiation and invalid humidity are rejected as missing. Impossible dates are rejected.

Monthly/yearly rain is the mean of actual complete-period totals (including leap days); heat counts are mean annual days with Tmax ≥35°C. Rainfall trend is OLS on accepted annual totals and their actual year IDs, normalized by mean annual rain as % per decade. This is a descriptive rate without a significance test or forecast. Zero mean rain leaves the percentage trend unavailable.

The prior fixed 38 heat days, −2.8% trend and universally high classes are no longer used for observed profiles. Regression year/value misalignment was fixed. Missing rainfall or nonconsecutive dates break dry spells; missing Tmax counts against coverage. Partial boundary seasons cannot pass as complete seasons. The existing provisional risk thresholds remain uncalibrated and visible as reviewable screens. Rainfall alone cannot establish flood hazard.

Monthly Tmax and seasonal maxima retain the existing extreme-value meaning: the highest daily maximum over the historical period, not the average daily high. The display now explains this, and the chart's temperature axis follows the data rather than clipping values above 40°C.

| Reference | SRTM elevation | Slope | POWER rain/year | Days/year ≥35°C | Rain trend %/decade |
| --- | --- | --- | --- | --- | --- |
| Muñoz | 71 m | 1.87% | 2764.8 mm | 60.2 | +0.9 |
| Ilagan | 42 m | 1.33% | 2779.3 mm | 37.6 | +30.0 |
| Pototan | 25 m | 2.08% | 2729.3 mm | 10.1 | +21.1 |
| Malaybalay | 630 m | 1.63% | 2428.0 mm | 0.0 | +25.5 |

SRTM represents the surface in February 2000, with an EGM96 vertical reference. Vegetation/buildings, meter quantization and acquisition age affect slope/elevation; this is not a survey. The [public sampling mirror](https://www.opentopodata.org/datasets/srtm/) documents SRTM v3; retained responses prove what the mirror returned, not independent agreement with authenticated original HGT files. The slope method follows the [Horn operator documented by GDAL](https://gdal.org/en/stable/programs/gdaldem.html) with separate local east/west and north/south spacing.

## Contracts, compatibility and privacy

Existing exports and service signatures are preserved. LandSummary elevation/slope/flood/erosion and monthly NDVI now allow null, and NDVI gains optional evidence counts. MonthlyClimatePoint.tempMin permits null. DailySeries adds optional t2mMin and the `bundled-model` tier. Earlier soil additions retain optional SoilData.modelEvidence and the shared provenance tier. Consumers guard nulls; legacy numeric fixtures remain valid and all legacy tests pass. A shared status label now says bundled scientific data rather than calling all sources soil predictions. Newly added UI strings/method explanations have EN/FIL keys; native Filipino review remains pending.

Downloaded request JSON includes account information. Its original is not copied into the repository. The public archive keeps only explicitly allowlisted request parameters, plus the original public scientific CSV, metadata, granule list and README. No credentials/account identifiers are bundled. Browser authentication was used for acquisition only; application users need no Earthdata account. Request-export status/timestamps are not treated as proof of the actual download time; NDVI `retrievedAt` is null because that timestamp was not supplied.

NASA data attribution/open-access policy and transformation notices are in [DATA_LICENSE.txt](../public/data/real-data/DATA_LICENSE.txt). SoilGrids has its separate CC BY 4.0 attribution. No source is claimed to guarantee agronomic outcomes or NASA endorsement.

## Reproduction and verification

```bash
python3 scripts/real-data/acquire-terrain.py --cache /tmp/fieldshift-terrain-v1
python3 scripts/real-data/acquire-power.py --cache /tmp/fieldshift-power-v1
python3 scripts/real-data/import-ndvi.py --input /path/to/appeears-downloads
python3 scripts/real-data/verify.py
shasum -a 256 -c public/data/real-data/SHA256SUMS
```

Acquisition is serial and bounded; cached requests resume. Scripts refuse to replace a different versioned JSON package. Preserve original download names. ZIP entry timestamps are fixed and source acquisition times stay in manifests; cached rebuilds are reproducible. A future refresh needs deliberately versioned paths/schema/imports, not silent replacement. No Python dependency is added for this group. Soil raster verification has its separate pinned Python requirements.

Observed automated results:

- `npm test`: exit 0; 240 passed, 4 skipped; 26 files passed, 1 skipped. Skips are three optional Gemini audits and the opt-in live POWER test.
- `npx tsc -b`: exit 0; explicit `npx tsc -p tsconfig.app.json --strict --noEmit` and `npx tsc -p tsconfig.node.json --strict --noEmit`: exit 0 each. Effective configs still do not themselves enable strict; explicit checks cover that existing gap.
- `npm run lint`: exit 0; no diagnostics.
- `npm run build`: exit 0. Existing node:fs/node:path browser externalization warnings remain. Existing large-chunk warning remains and the offline data increases payload: main JS 1576.29 kB (419.94 kB gzip); lazy POWER chunk 1292.90 kB (382.44 kB gzip). No bundle-size warning is hidden or claimed fixed.
- Offline source audit: 52 terrain responses / 4900 posts, four POWER responses / 87648 values, and 464 NDVI rows + QA match retained source bytes; SHA checks pass. Public artifacts contain no exported account identifier/user_id. Rebuilt JSON/source archives match checksums. `git diff --check`: clean. Existing fixture/preset/crop diff: empty.
- Focused tests cover all four presets offline, masks/zeros/outside coverage, NDVI bits and unsupported trends, complete-year/temperature handling, gap-broken dry spells, excluded-year regression pairing, raw-cache reuse/timestamps and coordinate cache isolation. Existing race/stale-result/store tests pass.

Native Chrome spot review verified Muñoz 71 m / 1.87%, actual NDVI values/clear gaps, Ilagan 42 m / 1.33% and 0/115 accepted, and actual POWER values/method/status labels. Review caught and fixed the shared soil-only status label. Desktop screenshot inspected; no new mobile/print run for this terrain/NDVI/climate addition. The earlier soil group has its own completed 360 × 800 and four-page print review. Placeholder layout redesign, native translation review and scientific/field validation remain human follow-ups.

At this review stop, paste/update the accompanying PR draft only after inspecting changes. No original Ticket 10 work has started.

## Files in the branch working diff

The inventory below includes the earlier soil group and this source group; there is no implementation commit yet.
- `docs/DATA_GAP_RESOURCE_CATALOG.md`
- `docs/DATA_SOURCES.md`
- `docs/REAL_SOURCE_INTEGRATION_MILESTONE.md`
- `docs/SOILGRIDS_PILOT_MILESTONE.md`
- `public/data/real-data/DATA_LICENSE.txt`
- `public/data/real-data/SHA256SUMS`
- `public/data/real-data/ndvi-v1-source.zip`
- `public/data/real-data/power-v1-source.zip`
- `public/data/real-data/terrain-v1-source.zip`
- `public/data/soilgrids/DATA_LICENSE.txt`
- `public/data/soilgrids/SHA256SUMS`
- `public/data/soilgrids/pilots-v1-rasters.zip`
- `scripts/real-data/acquire-power.py`
- `scripts/real-data/acquire-terrain.py`
- `scripts/real-data/import-ndvi.py`
- `scripts/real-data/verify.py`
- `scripts/soilgrids/acquire.py`
- `scripts/soilgrids/requirements.txt`
- `scripts/soilgrids/validate.ts`
- `scripts/soilgrids/verify.py`
- `src/components/ClimateCard.tsx`
- `src/components/MapPicker.tsx`
- `src/components/PrintablePlan.tsx`
- `src/components/SoilCard.tsx`
- `src/components/SoilModelDetails.tsx`
- `src/data/provenance.ts`
- `src/data/real-data/ndvi-v1.json`
- `src/data/real-data/power-v1.json`
- `src/data/real-data/terrain-v1.json`
- `src/data/soilgrids/pilots-v1.json`
- `src/engine/candidateGenerator.ts`
- `src/engine/climate/climateSummary.ts`
- `src/engine/explainer.ts`
- `src/engine/scoring.ts`
- `src/i18n/en.json`
- `src/i18n/fil.json`
- `src/services/bundledNdvi.ts`
- `src/services/bundledPower.ts`
- `src/services/bundledSoilGrids.ts`
- `src/services/landSummary.ts`
- `src/services/nasaPower.ts`
- `src/services/observedClimate.ts`
- `src/services/realLandData.ts`
- `src/services/soilGrids.ts`
- `src/store/useAppStore.ts`
- `src/tests/bundledSoilGrids.test.tsx`
- `src/tests/climate/fallbackTiers.test.ts`
- `src/tests/dataIntegrity.test.tsx`
- `src/tests/engine.test.ts`
- `src/tests/landService.test.ts`
- `src/tests/provenance.test.tsx`
- `src/tests/realLandData.test.ts`
- `src/tests/realSourceIntegration.test.ts`
- `src/tests/soilGrids.test.ts`
- `src/tests/telemetryCacheTtl.test.ts`
- `src/types/contracts.ts`
- `src/types/index.ts`
- `src/types/soilGridsPackage.ts`


## Follow-up bug review — 15 November 2026

A brief targeted review fixed four reproducible problems:

1. Seasonal aggregation dropped valid rainfall whenever temperature or Tmax was missing on the same date. Each metric now uses its own valid readings; joint coverage still counts an incomplete day. Only missing rainfall or a calendar gap breaks a rainfall dry spell.
2. Daily hotter/hotter-drier transformations did not shift the newly added T2M_MIN array. They now apply the existing temperature delta to available minima, preserve nulls, and leave source/baseline data unchanged. No scenario identifiers, multipliers or scoring weights changed; this is not Ticket 10 consolidation.
3. A POWER response with another point's geometry could be attached to the selected field. Live/cache parsing now rejects mismatched coordinates when geometry is provided, allowing the request's four-decimal rounding. Explicit sample references keep their actual different source coordinates.
4. Persisted climate profiles accepted negative rainfall/radiation, out-of-range humidity or impossible annual heat counts. The derived-cache schema now rejects these; namespace v3 discards profiles previously accepted without the new response-coordinate check.

Files changed by this review: `src/engine/climate/climateSummary.ts`, `src/engine/climate/scenarios.ts`, `src/services/nasaPower.ts`, `src/tests/realSourceIntegration.test.ts`, `src/tests/climate/scenarios.test.ts`, `src/tests/provenance.test.tsx`, and this report. The PR draft in `/private/tmp/fieldshift-real-source-pr-draft.md` was updated. No datasets, UI strings or protected reference values changed.

Verification rerun: `npm test` exit 0 (240 passed / 4 skipped); `npx tsc -b`, explicit app/node strict checks, `npm run lint` and `npm run build` each exit 0. Lint has no diagnostics. Existing node-module externalization and large-chunk build warnings remain. Source/ZIP checksum checks and protected-reference diff remain clean. No new browser review was needed for these calculation/parser fixes. No commit, push, merge or next-ticket implementation was performed.
