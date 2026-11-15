# Scoring consistency: reproducible demonstration

This milestone implements the scoring/wording portion of Test 2. It does not claim a complete Test 2 or scientific/WCAG sign-off. No Test 1 walkthrough is required.

## Automated rehearsal

Run `npm run demo:regression`. It uses the normal store and bundled sources with demo soil assumptions disabled and external requests rejected. It verifies all four pilots, all five scenario rankings, Muñoz pH change/reset and a separately labeled synthetic steep-terrain case. It does not change raw observations or write farmer data. Run the required test/type/lint/build pipeline separately.

Real pilot expectations: Muñoz SRTM 72 m/2.43%, Ilagan 42 m/1.33%, Pototan 25 m/2.08%, Malaybalay 626 m/2.57%. Accepted NDVI composites: 77/115, 0/115, 16/115, 44/115 respectively. Missing observations remain missing. These are the packaged sources, not current field measurements.

## Browser rehearsal

1. Start `npm run dev`, open the root URL, then Launch App. Select Science City of Muñoz through its pilot button; do not type the legacy coordinates.
2. Field Conditions: inspect the source pH 6.4 and poor derived drainage. Keep these source limitations visible. In History & Goals, use previous rice, water/climate priorities 100%, income 100%, input/labor 15%.
3. Generate plans. Note a named sequence's soil/water/headline scores. Return to conditions, apply pH 5.1, then regenerate with unchanged priorities. That sequence's soil fit is lower; expand its risks to see catalog conflicts, exact team deductions and calibration caveat. Baseline scores may already be at their floor. Reset to source and confirm restoration.
4. Separately change drainage to Moderate. For a sequence whose crops accept that class, its water-fit pillar should improve. The edit is farmer-reported, not a new satellite measurement. Reset afterward.
5. Click all five climate scenarios. Adaptive plan scores descend in order; ties preserve baseline order. Existing baseline remains last as a benchmark. Switching back to Baseline restores baseline order. The engine compares the returned shortlist, not all possible rotations.
6. Compare two plans under a shock. Headline scores/order use that shock; the pillar heading identifies baseline inputs. Close and print: the printed #1 sequence and score should match the currently selected scenario's top adaptive plan. Baseline evidence remains explicitly labeled. Cancel the preview.
7. Open How Scoring Works and plan explanations. Confirm no fixed flowering dates, 7–10% yield-loss claim, guaranteed pest prevention, guaranteed plow-pan removal or field nitrogen quantity. Onion includes a local scouting caution. Source/model/derived status and local review remain visible. Repeat the affected text in Filipino. Native-speaker review remains pending.
8. Repeat pilot selection for Ilagan, Pototan and Malaybalay. All have plans with source-derived inputs. Ilagan has no accepted NDVI; Malaybalay is not the old synthetic 18%-slope demonstration. Do not change their genuine values to trigger a desired branch.

The synthetic 18% case in the automated rehearsal/unit test exercises steep terrain and corn-host continuity separately. It is not injected into the browser as Malaybalay data. A public steep-location demonstration needs an independently verified field/reference point.

## Scope and remaining QA

This milestone leaves source datasets, crop attributes, network/cache behavior and public scenario IDs intact. Scores intentionally change where stored soil preferences conflict; previous score hashes were updated after adding explicit direction/limits/reset regressions.

Known separate work: latest landing mobile-header clipping and visually hidden NASA footer credit; remaining legacy English strings, full keyboard/physical sunlight/contrast checks, cold offline reload and deployed Vercel configuration validation. The scoring/methodology dialogs receive focus containment, Escape dismissal and focus restoration, but this does not certify every application control.
