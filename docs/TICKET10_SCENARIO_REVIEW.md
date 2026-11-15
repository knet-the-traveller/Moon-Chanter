# Ticket 10 — Scenario consolidation review

Agent: Codex (GPT-6), 15 November 2026. Branch `dev2/next-work`, clean starting base `aab44a4` (merged PR #10). Fetch completed; starting HEAD and origin/main had zero commits of divergence. No commit/push/merge performed for this ticket.

## Scope and shared ownership

The developer assigned Ticket 10 directly. This authorizes the independently compatible shared-definition refactor. No Dev 1 message or approval is invented, and no external coordination message was sent. Scientific reconciliation of the two algorithms remains a shared Dev 1/developer decision before any future behavior-changing task; it is not required for this default-output-preserving refactor.

## API comparison and canonical boundary

| Entry point | Inputs and outputs | Retained purpose |
| --- | --- | --- |
| `engine/climate/scenarios.ts: applyScenario` | DailySeries → DailySeries; optional delta overrides | Dated temperature/rainfall sensitivity transformations, null preservation, exact baseline object identity |
| `engine/climate/scenarios.ts: summarizeAllScenarios` | DailySeries → five ClimateSummary results | Seasonal aggregation, daily threshold counts and descriptive trends |
| `engine/scenarios.ts: evaluateScenarios` | CandidateSequence + ClimateData + SoilData + priorities → scores/robustness/degradation | Rotation score stress tests and crop-specific penalties |

Canonical definitions live in `src/config/pilot.ts`: existing `PILOT_CONFIG.scenarios` holds +1.5°C, 0.85 and 1.15; `scenarioAdjustment` resolves them for both APIs. `CLIMATE_SCENARIO_IDS` defines canonical daily IDs and `ScenarioDeltas` remains re-exported from its previous module. Explicit adapters `toClimateScenarioId` and `toRotationScenarioId` preserve `hotter_drier` and `hotterAndDrier`. The existing public ID unions and result keys remain unchanged. No `compound` public ID is introduced.

Daily baseline still returns its input object. Existing custom daily deltas (including zero) and numeric rounding stay unchanged. Rotation scoring now reads the same perturbation definitions while preserving its independent penalties and compound formula. The golden pre-refactor comparison verifies unchanged default outputs. Future edits to canonical perturbations deliberately affect both paths and require the existing scientific review/tests; they are not presentation-only edits.

## Differences deliberately preserved

Daily transformation shifts observed daily temperature/minima/maxima and scales daily rain, then recomputes summaries. Rotation evaluation shifts seasonal maxima, adds the legacy illustrative 18 annual heat days, forces selected risk flags and applies crop-specific score adjustments/clamps. Its combined score is a weighted degradation formula (0.8/0.85), not a daily combined-weather simulation. The compound 0.85 coefficient remains independent of the drier rainfall multiplier despite having the same numeric value.

Replacing these rotation heuristics with daily-derived risks would change scores/scientific semantics and needs a separately directed reconciliation. This ticket does not calibrate thresholds or validate the legacy illustrative assumptions. Existing provisional-review disclosures remain applicable. Uniform rainfall scaling preserves occurrence timing; changes in dry-day threshold crossings can alter calculated dry spells. Neither path is a weather forecast or yield model.

## Consumer audit

Repository-wide search: `rg -n 'applyScenario|evaluateScenarios|summarizeAllScenarios|hotterAndDrier|hotter_drier' src scripts --glob '!*.json'`.

- `src/engine/index.ts` calls rotation `evaluateScenarios`; no wiring change needed.
- `scripts/climate-demo.ts` imports daily summaries and the existing type export; no change needed.
- `src/components/ScenarioBar.tsx`, store actions and `src/types/index.ts` keep rotation IDs; no UI migration needed.
- Daily/rotation regression tests import their original entry points.
- Both modules stay because their exported capabilities are distinct; deleting either would lose behavior. No caller currently crosses these boundaries; explicit adapters are available for future wiring.

## Files changed

- `src/config/pilot.ts`: shared IDs, delta type, adjustment resolver and explicit adapters.
- `src/engine/climate/scenarios.ts`: consume shared definitions; preserve old exports/signatures.
- `src/engine/scenarios.ts`: consume shared temperature/rain perturbations; preserve scoring heuristics.
- `src/tests/climate/scenarios.test.ts`: adapter round trips/defaults/zero overrides.
- `src/tests/engine.test.ts`: pre-refactor hashes for every scenario evaluation across 90 candidates from three valid municipal soil fixtures.
- This review report. PR draft: `/private/tmp/fieldshift-ticket10-pr-draft.md`.

No UI/data/shared-contract migration. No fixture values, crop data, cache behavior or source packages changed.

## Observed verification

All commands exit 0:

- `npm test`: 242 passed, 4 skipped; 26 files passed, 1 skipped. Skips are three optional Gemini audits and opt-in live POWER integration.
- `npx tsc -b`; explicit app and node `--strict --noEmit` checks (existing configs do not themselves enable strict).
- `npm run lint`: no diagnostics.
- `npm run build`: success with existing node:fs/node:path browser externalization and large-chunk warnings. Main JS 1576.90 kB / 420.06 kB gzip; lazy POWER 1292.90 kB / 382.44 kB gzip.
- `git diff --check`: clean; protected fixture/preset/crop diff empty.

Golden hashes were captured before source edits and rechecked afterward (30 candidates each: Muñoz, Ilagan, Pototan). The Malaybalay legacy fixture has no valid candidates under existing required-input rules; it was not counted as meaningful score coverage. Existing daily tests cover all five cases, custom deltas, nulls, minimum temperature, and baseline equivalence. No new UI/manual review needed for this calculation/configuration refactor. No live NASA call was needed for deterministic offline tests.

Review stop: Ticket 10's compatible consolidation is complete. Tickets 11–13 remain pending. Keep any future behavior-changing scientific reconciliation explicitly assigned.
