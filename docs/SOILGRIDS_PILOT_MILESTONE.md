# SoilGrids pilot-data milestone

Branch: `dev2/soil-source-integration`, based on `origin/main` at `b097a7f6684856e3ff0a87157e81131c747f9200`.
This milestone implements SOIL-01 from the [resource catalog](DATA_GAP_RESOURCE_CATALOG.md). Terrain, scientific NDVI time series, calculated climate risks and economics remain separate milestones.

## What changes

The four pilot hubs now have separate native raster extracts. Each extract contains 81 cells in a 9 × 9 grid (2.25 × 2.25 km), centered on the cell containing the existing preset coordinates. This covers a small area around each point; it is not municipality-wide coverage. A selected coordinate resolves to its containing cell using WGS84 cell corners prepared from the native projection. Chord approximation and nine-decimal coordinate rounding are negligible at this scale; shared edges resolve deterministically to the first matching cell.

Within these grids, the shipped model package is selected before API caches or requests. A masked cell remains unavailable, even if another cell has predictions. Outside the grids, the existing validated seven-day cache → bounded REST request → labeled municipal example hierarchy remains. The provider currently describes its REST API as paused; the bundled extract avoids that dependency inside the pilot coverage. No new frontend service, credentials or raster-processing dependency is required.

The existing `public/sample-data/` fixtures, `src/data/pilotLocations.ts` and crop database retain their values. SoilGrids is an openly licensed supplementary source, not a NASA dataset; existing NASA imagery/climate integrations continue separately.

## Source, reuse and processing

- Provider: ISRIC — World Soil Information. [SoilGrids 2.0 dataset paper](https://doi.org/10.5194/soil-7-217-2021).
- Access: original public GeoTIFF windows referenced by the provider's VRT files, following the [WebDAV access workflow](https://docs.isric.org/globaldata/soilgrids/webdav_from_Python.html). No authentication.
- Release: source VRT metadata `Code_version=v2.0.0`; native 250 m interrupted Goode Homolosine grid. `/latest/` is mutable, so each source URL, VRT checksum, raster-subset checksum and actual retrieval time is retained.
- License: [CC BY 4.0, confirmed by ISRIC](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html). Attribution and adaptation notice are in `public/data/soilgrids/DATA_LICENSE.txt` and the downloadable archive. Data licensing is separate from application-code licensing.
- Observation period: unavailable for these predictions. Retrieval time is acquisition time, never a current observation date.
- Values: two depth intervals (0–5 cm and 5–15 cm), each with mean, Q05 and Q95. Raw integer values and per-depth uncertainty are preserved. No interpolation or resampling.

[ISRIC's layer documentation](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html) defines the mapped units and depth intervals. Conversion in this package is:

| Property | Stored mapped unit | Display conversion |
| --- | --- | --- |
| pH in water | pH × 10 | divide by 10 |
| Clay, sand, silt | g/kg | divide by 10 → % |
| Soil organic carbon | dg/kg | divide by 100 → % SOC |
| Bulk density | cg/cm³ | divide by 100 → g/cm³ |

The profile uses a thickness-weighted representative value: `(top-depth mean × 5 + lower-depth mean × 10) / 15`. Both means must exist. This differs intentionally from the legacy REST path's unweighted average, which is unchanged. Averaging pH predictions is a reviewable representative index, not a laboratory pH for a mixed sample. Q05/Q95 stay attached to each depth; they are not combined into an invented 0–15 cm prediction interval.

Original source TIFFs encode a WGS84 ellipsoid with an unnamed datum; ISRIC's master VRT and documented extraction projection assign WGS84. Acquisition uses that provider reference and checks matching native geometry. The audit normalizes this specific metadata representation without accepting another ellipsoid or projection. Numeric pilot-coordinate transforms match; this does not supply independent survey-grade geodetic validation.

## Missingness and scientific limits

The original source TIFFs explicitly mark missing pixels with `-32768`; JSON stores these as `null`. A test WCS response converted those pixels to zero and omitted nodata metadata. Acquisition therefore reads original raster windows rather than interpreting WCS zeros as soil measurements. Valid zeros in SOC/fractions remain valid.

Muñoz and Malaybalay's exact preset pixels have no pH prediction. Ilagan and Pototan's preset pixels have valid pH. Nearby cells can differ, including missingness; the app never substitutes a nearby pixel for the selected point. Ilagan uses its actual preset at **16.975, 121.810**, not the 17.148, 121.89 coordinate in some older tests.

Texture retains the existing local threshold classification, marked for review. It is not a validated USDA texture triangle. Drainage and organic-matter class remain unavailable until separately supplied: texture cannot establish drainage, and SOC is not measured organic matter. New explicit drainage buttons and existing texture/organic-matter/pH controls allow farmer input; these remain labeled farmer-reported and need local verification. Ranking stays paused while required inputs are missing. This can reduce the number of immediate demo recommendations, intentionally.

`[AGRO-RULE-05-MODEL-SUPPORT]` prevents these imported topsoil predictions from triggering the legacy subsoil-compaction screen, and prevents imported pH alone from determining sloping-upland terrain in candidate generation, scoring and explanation. Explicit slope remains usable. This adds no new agronomic threshold or score weight. Existing profiles without `modelEvidence` retain their legacy behavior, verified by the existing engine tests. Other crop, acidity, default-baseline and climate assumptions remain provisional and need separately scoped scientific review.

## Contracts and validation

`SoilData` adds optional `modelEvidence`; existing fields/signatures remain compatible. `MetricProvenance.tier` adds `bundled-model`. Provenance labels now say “Version” instead of automatically calling every product version an API version. Missing metrics retain their source/depth/retrieval metadata with an unavailable tier.

Zod validates the packaged JSON before use: schema/release, units, depths, value domains, nulls, quantile ordering, array sizes, pilot identifiers, native extents, geographic geometry, acquisition metadata and unique source slots. Damaged packaged JSON falls back to the existing source hierarchy. Acquisition and raster auditing run offline in Python; no Python package is added to the web application's dependencies.

## Reproduce and verify

From the repository root, use an isolated Python environment (tested with Python 3.9.6):

```bash
python3 -m venv /tmp/fieldshift-soil-tools
/tmp/fieldshift-soil-tools/bin/python -m pip install -r scripts/soilgrids/requirements.txt
/tmp/fieldshift-soil-tools/bin/python scripts/soilgrids/acquire.py --cache /tmp/fieldshift-soilgrids-v1
node --import tsx scripts/soilgrids/validate.ts
/tmp/fieldshift-soil-tools/bin/python scripts/soilgrids/verify.py
/tmp/fieldshift-soil-tools/bin/python scripts/soilgrids/verify.py --live
shasum -a 256 -c public/data/soilgrids/SHA256SUMS
```

The acquisition script makes serial, bounded, retried public requests and caches intermediate results. Preserve the cache to resume. It refuses to replace an existing versioned JSON package with different contents. For a refreshed release, create new package paths/ID and update the schema/import deliberately; downloading mutable `/latest/` into the old version is not a refresh workflow. ZIP entries have fixed archive timestamps for reproducibility; actual acquisition times remain in the manifest.

Artifacts: `src/data/soilgrids/pilots-v1.json`, `public/data/soilgrids/pilots-v1-rasters.zip` (144 clipped TIFFs and manifest), license notice and SHA256SUMS. The JSON contains 11,664 source predictions (including nulls): 4 × 81 cells × 6 properties × 2 depths × 3 statistics.

Use [LOCAL_TESTING_GUIDE.md](LOCAL_TESTING_GUIDE.md) to launch the app. Select each pilot, open Field Conditions, and inspect the model details and per-depth table in EN/FIL. Check masked and valid points, move outside coverage, supply missing field inputs, reset overrides, and inspect provisional recommendations/printing. Native Filipino wording and agronomic interpretation require human review.

Automated and visual validation results, touched files and pending reviews are recorded in the milestone PR draft generated when the branch work is completed.


## Observed review results — 15 November 2026 (Asia/Manila)

Stopped at the SOIL-01 milestone. No commit, push, PR publication or merge was performed. The branch has no upstream configured; `main` and the preserved baseline/parent refs were not changed by this implementation.

Acquisition timestamps span **2026-11-14 21:51:56 UTC to 22:09:24 UTC** (15 November in Manila). These are retrieval times; observation dates remain unavailable.

| Preset | Valid 0–5 cm pH cells / 81 | Representative 0–15 cm pH at exact preset |
| --- | --- | --- |
| Muñoz | 63 | Unavailable (source nodata) |
| Ilagan | 79 | 5.6 |
| Pototan | 73 | 5.7 |
| Malaybalay | 67 | Unavailable (source nodata) |

Representative **model-cell centers for UI testing**, not surveyed farm locations: Muñoz **15.7238862, 120.9001025** (pH 6.4); Ilagan **16.9837733, 121.8055661** (pH 5.6); Pototan **10.9605694, 122.6264859** (pH 5.8); Malaybalay **8.1645630, 125.1191357** (pH 5.3). Each is cell 1 of its corresponding grid. The app does not relocate the selected point to these examples.

| Command / check | Observed result |
| --- | --- |
| `npm test -- --reporter=json --outputFile=/private/tmp/fieldshift-soilgrids-tests.json` | Exit 0; **214 passed, 4 skipped, 0 failed**. Skips: three optional local GEMINI rule audits and the opt-in live NASA POWER test. |
| `npx vitest run src/tests/bundledSoilGrids.test.tsx` | Exit 0; **25 passed** after the final download-link change. |
| `npm run lint` | Exit 0; no warnings or errors. |
| `npx tsc -b` | Exit 0; no diagnostics. |
| `npx tsc -p tsconfig.app.json --strict --noEmit` | Exit 0; no diagnostics. |
| `npx tsc -p tsconfig.node.json --strict --noEmit` | Exit 0; no diagnostics. |
| `npx tsc --ignoreConfig --noEmit --strict --types node --module nodenext --moduleResolution nodenext --allowImportingTsExtensions --target ES2023 --skipLibCheck scripts/soilgrids/validate.ts` | Exit 0; preprocessing validation script also type-checked. |
| `npm run build` | Exit 0; existing `node:fs` / `node:path` externalization warnings from `nasaPower.ts` and the existing >500 kB chunk warning remain. Main JS: 1,339.45 kB minified / 385.42 kB gzip. The bundled extract adds about 32 kB gzip relative to the prior 353.46 kB gzip build; no frontend dependency was added. |
| `node --import tsx scripts/soilgrids/validate.ts` | Exit 0; all four grids pass Zod validation. |
| Python `scripts/soilgrids/verify.py --live` in the pinned preprocessing environment | Exit 0; all **144** clipped TIFF checksums/arrays, native geometry, archive manifest/license and **four fresh original pH source-window checks** pass. Fresh checks are pH windows, not re-downloads of all 144 inputs. |
| Cached acquisition rebuild with before/after SHA-256 comparison | Exit 0; JSON and ZIP reproduced byte-for-byte; all 36 source VRT projections checked. |
| `shasum -a 256 -c public/data/soilgrids/SHA256SUMS` | Exit 0; both artifacts OK. JSON 129,108 bytes; ZIP 141,158 bytes. |
| Production download copy compared with source ZIP (`cmp`) | Exit 0; identical. |
| `git diff --exit-code -- public/sample-data src/data/pilotLocations.ts src/data/crops.json` | Exit 0; protected existing references unchanged. |
| `git diff --check` | Exit 0; no whitespace errors. |

The project configs still do not enable strict mode themselves; the explicit app/node strict checks above cover this milestone without changing compiler configuration. During acquisition, type checking initially reported the not-yet-created JSON; final checks above passed. The sandbox blocked the `tsx` CLI's IPC socket, so validation used `node --import tsx`. An added projection assertion initially rejected the provider's equivalent unnamed-datum TIFF representation; the documented normalization and final source audit resolved that diagnostic.

Pending human checks: visual/mobile layout at 360 px, actual keyboard interaction and print layout, native-speaker Filipino review, and local agronomic interpretation. Browser inventory reported the browser host unavailable, and native Safari control timed out twice; no visual pass is claimed. SSR checks verify localized source disclosures, missing-data recovery controls and markup. Drainage, organic matter, crop assumptions and field applicability still need local evidence. Terrain/NDVI/climate-risk/economic gaps remain outside this milestone.

A complete PR draft is prepared at `/private/tmp/fieldshift-soilgrids-pr-draft.md` using the repository template. Paste it into a future PR description after reviewing this branch; it has not been published.

## Every file touched (30)

- `docs/DATA_GAP_RESOURCE_CATALOG.md`
- `docs/DATA_SOURCES.md`
- `docs/SOILGRIDS_PILOT_MILESTONE.md`
- `public/data/soilgrids/DATA_LICENSE.txt`
- `public/data/soilgrids/SHA256SUMS`
- `public/data/soilgrids/pilots-v1-rasters.zip`
- `scripts/soilgrids/acquire.py`
- `scripts/soilgrids/requirements.txt`
- `scripts/soilgrids/validate.ts`
- `scripts/soilgrids/verify.py`
- `src/components/SoilCard.tsx`
- `src/components/SoilModelDetails.tsx`
- `src/data/provenance.ts`
- `src/data/soilgrids/pilots-v1.json`
- `src/engine/candidateGenerator.ts`
- `src/engine/explainer.ts`
- `src/engine/scoring.ts`
- `src/i18n/en.json`
- `src/i18n/fil.json`
- `src/services/bundledSoilGrids.ts`
- `src/services/soilGrids.ts`
- `src/tests/bundledSoilGrids.test.tsx`
- `src/tests/dataIntegrity.test.tsx`
- `src/tests/engine.test.ts`
- `src/tests/provenance.test.tsx`
- `src/tests/soilGrids.test.ts`
- `src/tests/telemetryCacheTtl.test.ts`
- `src/types/contracts.ts`
- `src/types/index.ts`
- `src/types/soilGridsPackage.ts`
