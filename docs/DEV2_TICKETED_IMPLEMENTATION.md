# Dev 2 Ticketed Implementation Plan

This merged handoff combines the original Dev 2 plans with the revised attachment `DEV2_TICKETED_IMPLEMENTATION-2.md`. Root `AGENTS.md` supplies the standing rules. [DEV2_IMPLEMENTATION_PLAN.md](DEV2_IMPLEMENTATION_PLAN.md) records the scope and reconciliation decisions.

These are future implementation assignments. The current document-merge task authorizes documentation edits. Begin a ticket when the developer assigns it. Use the ticket numbers and titles in this file because earlier drafts used different numbering.

## Execution and authorization

- Implement one assigned ticket at a time, in order. A completed ticket must leave the application buildable. Keep pure helpers independently usable until the complete service is ready.
- An assignment covering several tickets authorizes the full stated sequence. Validate each ticket before continuing to the next assigned ticket.
- Use the assigned non-main branch or worktree. `dev2-satellite` is the branch observed during this merge. A separate branch per ticket is optional unless the developer requests it. Preserve existing uncommitted work and carry completed dependencies into subsequent tickets.
- An implementation request authorizes the ticket's listed files and support files described below, within the stated scope. Reading the plan grants no implementation authorization. Raise a material expansion of protected code with the developer before editing it.
- Every behavior-changing ticket may add or update directly relevant files in `src/tests/`. Every UI-changing ticket may update `src/i18n/en.json` and `src/i18n/fil.json`. These support files form part of its approved scope.
- Ticket 0 identifies additional import consumers and concrete schema locations. Record exact paths in its report. File lists explicitly covering discovered import consumers authorize import/type wiring in those consumers. Broader logic changes require developer direction.
- Use existing dependencies. Existing React server-rendering APIs and Vitest may provide rendering checks. Request an additional dependency only when existing tools cannot satisfy a specific acceptance criterion.
- Commit or push when the developer requests it. Use Conventional Commits when committing.

### Assignment template

```text
Read AGENTS.md and implement Ticket N from docs/DEV2_TICKETED_IMPLEMENTATION.md.
Use the assigned non-main branch or worktree.
Keep changes within the ticket and its approved support files.
Preserve existing work, caller behavior, and fixture values.
Run the required checks and report their exact results.
Report shared-contract changes, needsReview items, limitations, and pending decisions.
```

## Verification for every ticket

Run the following checks and record each exit code and relevant totals or diagnostics.

```sh
npm test
npx tsc -b
npm run lint
npm run build
```

For each project whose effective configuration leaves `strict` disabled, also run its explicit strict check. Both projects required this verification during the instruction review.

```sh
npx tsc -p tsconfig.app.json --strict --noEmit
npx tsc -p tsconfig.node.json --strict --noEmit
```

Run type checks sequentially with the production build because they may share TypeScript build artifacts. Use focused tests during development and all required checks before the completion report. Record the initial baseline in Ticket 0. Fix task-introduced errors and warnings within scope. Record unrelated existing warnings and failures separately, including exit codes and diagnostics, with affected acceptance criteria pending for failures. Preserve default offline-safe tests and the opt-in `RUN_LIVE_TESTS=true` integration check.

Add focused tests alongside the ticket introducing behavior. Ticket 11 completes cross-feature coverage. UI tickets also require manual checks for keyboard access, 360px layout, English/Filipino presentation, and relevant print output. Distinguish executed checks from pending checks.

## Shared requirements

- Preserve a zero-auth client-side SPA and the four pilot hubs. Keep existing FieldShift branding until the developer supplies a replacement. The planning target is 2026. Verify official challenge wording before claiming submission alignment.
- Keep NASA POWER, public GIBS imagery, and the existing SoilGrids flow working. Serve land signals and any assigned SMAP, GPM IMERG, ECOSTRESS, SRTM, DA-BSWM, and FAO GAEZ-style sample indicators from municipal fixtures. Limit additions to the fields needed for this handoff and identify illustrative values clearly.
- Reuse `src/services/cache.ts` and its storage fallbacks. The intended TTL for applicable live JSON data is seven days. GIBS tile caching needs its own technical assessment. Record actual tile behavior without promising an application-managed tile cache.
- Validate coordinates, fixtures, external responses, and consumed persisted payloads with Zod when introducing a data consumer or changing parsing or structure. Use `unknown` before validation. Keep TTL/import changes within their assigned scope and record unrelated legacy validation gaps for follow-up. Keep existing exports and callers compatible.
- Keep orchestration in Zustand, data acquisition and land helpers in services, and deterministic scoring in the engine. Components render data and invoke actions.
- Use Tailwind utilities and existing design tokens. Provide accessible labels, semantic headings, keyboard access, high sunlight contrast meeting WCAG AA, responsive layouts from 360px, and readable print output.
- Resolve new UI strings through the existing two-argument `getTranslation(language, path)` in `src/i18n/index.ts`. Format dynamic placeholders after lookup using typed values. Add identical leaf keys and compatible placeholders in both translation files. Report newly authored Filipino text for native-speaker review.
- Attach `needsReview: true` and a specific review note to unsourced scientific assumptions. JSON uses `note`; TypeScript constants may use adjacent typed metadata. Propagate review status and sample/synthetic provenance to derived values and visible disclosures.
- Use primary sources when verifying product specifications or scientific methods. Record product/version, variable, units, resolution, observation dates, retrieval dates, and the citation supporting each claim. Mark unavailable metadata explicitly.

## Dependency order

| Ticket | Deliverable | Prerequisites |
| --- | --- | --- |
| 0 | Read-only repository audit | Current checkout |
| 1 | Compatible LandSummary contract | Audit |
| 2 | Municipal land fixtures and validation | Contract |
| 3 | NDVI profile and supported trend calculation | Fixtures |
| 4 | Terrain flood screening helper | Contract and fixture units |
| 5 | Bare-field and RUSLE helpers | NDVI and fixture factors |
| 6 | Complete land service and cache alignment | Tickets 1–5 |
| 7 | Location and map integration | Complete service |
| 8 | Metric provenance across dashboard and print | Service and state |
| 9 | Per-plan local review checklist | Provenance |
| 10 | Scenario consolidation assessment and compatible refactor | Owner coordination |
| 11 | Cross-feature regression coverage | Tickets 1–10 |
| 12 | Product and submission documentation | Implemented behavior |
| 13 | Final QA and validation report | All preceding acceptance criteria |

The flood and erosion helpers precede the service so required risk fields can be computed when the service first ships. Ticket 10 can proceed once shared ownership is resolved. Continue independent assigned work if that coordination is pending.

## Ticket 0 — Repository audit

### Scope

Read repository files and run checks. Keep tracked and untracked source/document contents intact. Return the audit in the task report.

### Tasks

- Record branch, worktree, working-tree changes, package scripts, installed tool availability, and baseline verification results.
- Inspect effective compiler options for both referenced TypeScript projects. Record whether strict mode is configured and run the explicit strict checks where needed. Configuration changes require their own assigned scope.
- Locate year references, authentication requirements, credential configuration, and repository URLs with file and line references. Report secret findings using redacted locations. Distinguish historical observation dates from outdated event claims and public Earthdata hostnames from login requirements.
- Inspect the four pilot presets, municipal fixtures, and actual consumers. Resolve Malaybalay's `bukidnon` preset ID and `malaybalay.json` filename without renaming the preset.
- Inventory shared types, every proposed LandSummary producer/consumer, store location actions, soil override behavior, and existing translation APIs. Verify whether a `SoilProfile` type exists before naming it in changes.
- Identify Zod imports/schemas and validation gaps. If there is no shared schema location, use the scoped `src/types/landFixture.ts` module in Ticket 2 and document that choice.
- Report cache exports, storage tiers, caller TTLs, and GIBS tile behavior. Inventory public endpoints, timeouts, and fallbacks.
- Compare both scenario modules by input/output types, transformation behavior, scoring behavior, IDs, constants, and all import sites, including scripts and tests.
- Check recursive translation leaf-key and placeholder parity. Identify existing facilities for rendering tests and browser QA.
- Confirm the repository URL from local project evidence, including `git remote -v`. Ask about branding, ownership, or scientific choices only where evidence remains ambiguous. Continue independent audit work.

### Acceptance criteria

- Audit report contains concrete paths, baseline check results, known gaps, and implementation dependencies.
- Existing work is preserved and the audit introduces no source/document edits or commits.
- Findings replace assumptions from earlier plans before any implementation starts.

## Ticket 1 — LandSummary contract

### Approved files

- `src/types/contracts.ts`
- `src/types/index.ts`
- `src/store/useAppStore.ts`, for nullable state/type wiring
- Existing LandSummary producers/consumers discovered in Ticket 0, for compatibility wiring only
- Relevant test files under the shared support-file allowance

### Requirements

Define one canonical LandSummary type and export it through `src/types/index.ts`. Keep the existing ClimateSummary and other contracts compatible. The minimum target shape is below.

```ts
export interface LandSummary {
  elevationM: number;
  slopePct: number;
  floodProne: boolean;
  bareFieldMonths: number[];
  rusleErosionRiskTonsHaYr: number;
  ndvi: {
    seasonalMean: number[];
    trend: number;
    source: string;
  };
  landCover?: string;
  isSample: boolean;
}
```

- `elevationM` is finite and uses meters. `slopePct` is finite, nonnegative, and uses percent.
- `bareFieldMonths` contains unique sorted integers from 1 through 12. Erosion is finite and nonnegative in metric tonnes per hectare per year.
- `ndvi.seasonalMean` contains exactly 12 finite values in [-1, 1], ordered January through December. `ndvi.trend` has units of NDVI change per year.
- Preserve optional `landCover` for shared-contract compatibility.
- Add typed metadata within these approved type files as needed for sample hub identity/distance, per-metric provenance, review status/notes, and trend availability. Specify its shape and consumers in the report. A numeric trend fallback of zero must have an accompanying availability/reason indicator.
- Keep land state nullable until actual data is ready. Existing producers must return valid data or remain explicitly unavailable while awaiting Ticket 6.

### Acceptance criteria

- Strict TypeScript compiles through existing entry points, with one canonical export.
- Existing consumers remain compatible. New fields have documented units and invariants.
- Contract changes and required downstream wiring are reported. Standard checks pass.

## Ticket 2 — Municipal land fixtures and Zod schema

### Approved files

- `public/sample-data/munoz.json`
- `public/sample-data/ilagan.json`
- `public/sample-data/pototan.json`
- `public/sample-data/malaybalay.json`, new
- `src/types/landFixture.ts`, new schema module unless Ticket 0 identifies an existing equivalent schema to extend
- Relevant tests

### Requirements

- Preserve every existing value and structure in the three existing municipal fixtures. They currently contain `location`, `climate`, and `soil`. Add a consistent `land` block with terrain, NDVI, RUSLE factors, and metadata. Reuse `location` for hub name, province, coordinates, and existing elevation through a typed adapter when appropriate.
- Validate the common land extension and required location fields. Existing unrelated fixture fields may differ. Preserve them while validating the fields consumed by this workstream.
- Include slope, 12 monthly NDVI values, RUSLE factors `R`, `K`, `LS`, and `P`, plus source/variable/unit/resolution/date metadata. Record whether values are sourced, synthetic, or derived and include `needsReview` and `note` where applicable.
- Add optional dated annual or comparable seasonal NDVI observations only when evidence exists. A monthly climatology alone supports seasonal means.
- Keep observation period and retrieval date separate. Represent missing retrieval evidence explicitly. A fixture creation date may be recorded independently.
- Create Malaybalay's fixture using the common land/location shape. Add climate or soil blocks only if an existing consumer actually requires them, with evidence or explicit synthetic labeling. Preserve compatibility with the `bukidnon` preset ID.
- Preserve the existing sample files and pilot constants as references. If a preset is genuinely missing, report the specific gap and request authorization for the preset edit while continuing independent fixture work.
- For unavailable scientific data, use explicitly illustrative synthetic fixtures with review notes. Treat their derived outputs as illustrative. Document what SRTM, MODIS/VIIRS, DA-BSWM, or another primary source must verify.

### Acceptance criteria

- Four municipal fixtures pass the shared land schema, including finite coordinate/terrain/factor validation and NDVI bounds.
- An automated structural comparison proves all previously existing JSON values are unchanged.
- The shared land/location shape is consistent without changing old climate/soil data.
- Source and review status are traceable for new fields. Standard checks pass.

## Ticket 3 — NDVI seasonal profile and trend

### Approved files

- `src/services/landSummary.ts`, new pure NDVI helpers
- `src/types/landFixture.ts`, NDVI validation only if needed
- `docs/METHODOLOGY.md`, NDVI interpretation and trend availability
- Relevant tests

### Requirements

- Return the 12 validated monthly fixture values as `seasonalMean`.
- Compute an ordinary least-squares trend only from dated, comparable observations across years. Use elapsed years or annual observations for the independent variable and document the unit and handling of missing points.
- With too few comparable points or zero time variance, return numeric zero for contract compatibility and mark the trend unavailable with its reason. Render that state as insufficient data when surfaced in the UI.
- Label fixture sources as sample or synthetic, with the actual product reference when verified. Preserve availability/review metadata through derived results.
- Keep helpers independent of store state and network calls.

### Acceptance criteria

- Profile length/range checks, known positive and negative annual slopes, constant-series slope, insufficient observations, repeated dates, and invalid inputs are covered.
- Monthly seasonality cannot be displayed as an observed interannual trend.
- Standard checks pass.

## Ticket 4 — Terrain flood screening

### Approved files

- `src/services/landSummary.ts`
- `docs/METHODOLOGY.md`
- Relevant tests

### Requirements

- Export pure `isFloodProne(elevationM, slopePct): boolean` using the proposed rule `elevationM < 30 && slopePct <= 3`.
- Name the elevation/slope thresholds and attach typed `needsReview` metadata identifying the need for local validation. Retain rule ID `[LAND-RULE-FLOOD]`.
- Validate finite inputs and documented units before invoking the rule.
- Describe the result as a preliminary low-elevation/gentle-slope terrain screen. Document its limitations for river flooding, drainage, storm exposure, and local infrastructure.
- Report the four hubs' classifications using their fixture values. Threshold changes require a separately authorized scientific decision supported by evidence.

### Acceptance criteria

- Boundary tests include elevation exactly 30 m and slope exactly 3%, with values on either side.
- The report shows which hubs are flagged, including a result of all or none.
- Unverified/synthetic inputs remain visible in derived review status. Standard checks pass.

## Ticket 5 — Bare-field months and RUSLE estimate

### Approved files

- `src/services/landSummary.ts`
- `docs/METHODOLOGY.md`
- Relevant tests

### Requirements

For `[LAND-RULE-BARE]`, flag months with NDVI strictly below `0.25` inside `FALLOW_WINDOW_MONTHS`. The proposed default window is `[3, 4, 5, 6]`. Keep the threshold and window named, with `needsReview` metadata and a note requesting regional/cropping-calendar validation. Describe low NDVI as a possible bare/fallow signal with relevant observation limitations.

For `[LAND-RULE-RUSLE]`, calculate `A = R * K * LS * C * P` in metric tonnes per hectare per year.

- Obtain `R`, `K`, `LS`, and `P` from validated fixture fields. Record each factor's definition, compatible units, provenance, and review status.
- Derive `C` through one named, bounded monotonic function of annual mean NDVI. Select the mapping from a documented primary method or identify it explicitly as an illustrative assumption with `needsReview`. Record its formula and applicable range.
- Higher NDVI must produce a cover factor that is equal or lower. Validate negative/nonfinite factors and handle overflow as invalid data.
- Round the final annual estimate to one decimal place. Preserve review/synthetic status from every contributing factor.
- Document the estimate's spatial and process limitations, including the scope of modeled erosion processes. Add qualitative severity bands only when their thresholds have an assigned, documented basis.

### Acceptance criteria

- Tests cover NDVI exactly 0.25, inside/outside the fallow window, all-green profiles, sorted unique month output, monotonic C behavior, zero factors, invalid factors, and a hand-calculated RUSLE result.
- Identical validated inputs produce identical finite nonnegative outputs.
- Methodology lists every scientific assumption and review item. Standard checks pass.

## Ticket 6 — Complete land service and JSON cache alignment

### Approved files

- `src/services/landSummary.ts`
- `src/types/landFixture.ts`, service-boundary validation only
- `src/types/index.ts`, exports only
- `src/services/cache.ts`, shared TTL constant/export only
- `src/config/pilot.ts`, applicable API cache TTL configuration only
- `src/services/nasaPower.ts`, applicable cache-call TTL wiring only
- `src/services/soilGrids.ts`, applicable cache-call TTL wiring only
- Relevant tests

### Requirements

- Implement `fetchLandSummary(lat, lon, signal?: AbortSignal): Promise<LandSummary>` using the four bundled municipal fixtures and helpers from Tickets 3–5.
- Implement pure `buildSampleLandSummary(lat, lon, fixtures): LandSummary`, accepting already validated fixtures explicitly. This keeps synchronous construction independent of asynchronous public-file loading. Describe the concrete fixture type in the signature.
- Load canonical local fixture JSON through a bounded same-origin loading path and validate it. Reuse parsed fixtures within the session without retaining failed-load promises indefinitely. Preserve a usable local fallback when external services are unavailable.
- Choose the nearest valid pilot using geographic distance with a deterministic tie-break. Keep selected field coordinates distinct from fixture coordinates and expose the chosen hub and distance for disclosure. Custom points use the selected hub as a municipal proxy.
- Set `isSample: true` whenever fixture data contributes to the result. Propagate synthetic/review status and per-metric metadata.
- Keep the planned land path fixture-based. Any future live land provider requires its own assignment and verified zero-auth access.
- Validate coordinate ranges. A canceled request follows a documented cancellation path and must never replace a later request. A missing/corrupt local fixture may use another valid fixture with accurate provenance. If no valid fixture exists, return a controlled unavailable/error state through the caller rather than fabricated scientific values.
- Reuse the existing cache service and establish an explicit seven-day TTL for applicable live JSON callers/configuration. Preserve storage tiers, aliases, key compatibility, validation responsibilities, and fallback behavior. Limit existing service changes here to TTL wiring.
- Report GIBS browser/map caching as observed. Any custom tile-cache work remains a separately scoped implementation decision.

### Acceptance criteria

- All four exact hub coordinates and representative custom coordinates produce valid deterministic summaries while external network requests are unavailable.
- Tests cover nearest-hub selection, equal-distance tie behavior, invalid coordinates, corrupt/missing fixtures, cancellation, and repeated calls after failure.
- Cache checks verify the seven-day JSON TTL at the actual caller/configuration boundary.
- Standard checks pass, including production access to municipal fixture files.

## Ticket 7 — Map flow and state consistency

### Approved files

- `src/store/useAppStore.ts`
- `src/components/MapPicker.tsx`
- `src/App.tsx`, initial location/telemetry action wiring only if required
- `src/services/landSummary.ts`, cancellation/error integration only
- Translation files and relevant tests

### Requirements

- Route preset selection, map selection, coordinate entry, and GPS through a common store location pipeline. Preserve existing `selectPilotPreset`, `setCustomCoordinates`, and `fetchTelemetry` callers using compatible wrappers as needed.
- Update location immediately, reset location-specific overrides as existing behavior requires, and load land data for the selected point. Initialize the default preset through the same flow.
- Abort superseded land requests. Guard commits with a monotonically increasing request identity so A→B→A requests cannot accept an older A result. Apply the identity guard to climate/soil results and recommendation recomputation initiated by the same location change.
- Prevent late GPS callbacks from overwriting a newer explicit selection. Keep loading/error completion associated with the active request.
- Expose land loading/error/fallback state in Zustand and accessible localized UI. Identify previously loaded data as stale or clear it while a different location loads.
- Preserve current location when a request fails. Successful sample fallback is a usable result with a visible sample status. Fully unavailable fixture data yields an actionable localized status.
- Keep engine scoring inputs and soil override semantics unchanged within this ticket.

### Acceptance criteria

- Tests cover rapid selection changes, A→B→A, out-of-order climate/soil/land responses, cancellation, delayed GPS callbacks, failure recovery, and initial default selection.
- The selected location, committed telemetry, and recomputed plans belong to the same active request.
- Presets, map click, coordinate entry, and GPS work through existing UI entry points. Standard checks pass.

## Ticket 8 — Provenance across dashboard and print

### Approved files

- `src/data/provenance.ts`, new shared metadata/formatting definitions
- `src/types/contracts.ts` and `src/types/index.ts`, additive provenance metadata only
- `src/services/nasaPower.ts`, provenance population/validation only
- `src/services/soilGrids.ts`, provenance population/validation only
- `src/services/landSummary.ts`, provenance population only
- `src/components/ClimateCard.tsx`
- `src/components/SoilCard.tsx`
- `src/components/MapPicker.tsx`
- `src/components/PrintablePlan.tsx`
- `src/components/RotationCard.tsx`
- `src/components/ComparisonModal.tsx`
- Translation files and relevant tests

### Requirements

- Display `source | variable | spatial resolution | date range` for every NASA-derived, terrain, and soil metric shown by these views, including derived evidence within plans.
- Centralize reusable metadata/formatting in `src/data/provenance.ts`. Observation dates, actual sample hub, source tier, and review status come from the consumed data. Keep labels consistent through cache hits, fallbacks, printing, and comparison.
- Verify each product/variable's resolution, depth where relevant, units, and observation period from primary documentation. Earlier drafts' `NASA POWER | PRECTOTCORR | 0.5° | 2015–2025` and `SoilGrids | organic carbon | 250 m | 2022 snapshot` were illustrative labels requiring verification.
- Keep source periods separate from event years and retrieval dates. Display unavailable metadata with review status. Derived classifications disclose their input source and method.
- Identify sample, synthetic, cached-live, and farmer-overridden values accurately. Farmer override provenance must survive the effective-soil merge and reset correctly without changing override precedence or soil classification logic.
- Route surrounding labels, missing-data wording, and status text through translations. Product/variable identifiers retain their scientific names.
- Render unsupported NDVI trends as insufficient data using Ticket 3's availability metadata.

### Acceptance criteria

- Rendering checks cover each affected card, comparison view, and print output, with live, cached, sample, unavailable-metadata, and overridden states where applicable.
- Every visible metric can be traced to the active data and verified or review-marked metadata.
- Existing soil and climate numerical behavior stays compatible. Contract additions are reported. Standard checks pass.

## Ticket 9 — Local review checklist per plan

### Approved files

- `src/engine/explainer.ts`, checklist descriptor generation only
- `src/engine/index.ts`, explanation/checklist wiring only if required
- `src/types/index.ts` and `src/types/contracts.ts`, additive checklist descriptors only if required
- `src/components/RotationCard.tsx`
- `src/components/ComparisonModal.tsx`
- `src/components/PrintablePlan.tsx`
- Translation files and relevant tests

### Requirements

- Every plan displays the English heading `Information Gaps & Local Review Checklist`, registered in both languages.
- Generate shared checklist descriptors in the existing explainer. Resolve translation keys through `getTranslation(language, path)` and format descriptor parameters after lookup in each presentation context. Keep wording centralized in the translation files and verify matching placeholders across languages.
- Include actual data limitations, the sources using municipal fixtures, sample/synthetic/review status, pixel-scale limitations, and reminders to verify canal turnouts, plow-pan compaction, and local buyer prices.
- Accept provenance context explicitly and keep the explainer deterministic. Keep scoring weights, climate multipliers, candidate generation, plan rankings, and agronomic calculations compatible.
- Reuse checklist content across dashboard, comparison, and printed plans. Explain coarse spatial coverage and locally unverified conditions in farmer-facing language.

### Acceptance criteria

- Every plan has a checklist in all three presentation contexts.
- Sample/live/override/review context and language changes update the checklist accurately.
- Score and ranking regression checks remain unchanged. Heading hierarchy, keyboard access, contrast, and print legibility are checked. Standard checks pass.

## Ticket 10 — Scenario consolidation assessment and compatible refactor

### Approved files

- `src/engine/climate/scenarios.ts`
- `src/engine/scenarios.ts`
- `src/engine/index.ts`, scenario imports/wiring only
- `src/config/pilot.ts`, shared scenario definitions only
- `src/components/ScenarioBar.tsx`
- `src/types/index.ts`, existing scenario-ID compatibility only
- `scripts/climate-demo.ts`
- Additional import consumers identified in Ticket 0, import/API compatibility wiring only
- Translation files and relevant tests

### Requirements

- Coordinate shared scenario ownership with Dev 1 through existing task context. The developer may assign or resolve ownership. Keep unresolved coordination visible while progressing independent assigned work.
- Start with the audit's API comparison. Currently one module transforms `DailySeries` and summarizes `ClimateSummary`, while the other evaluates rotation scores from `ClimateData`. Preserve both capabilities.
- Identify genuinely shared scenario definitions/transformations and consolidate those where behavior can remain compatible. Choose and report the canonical definitions and adapter boundaries.
- Preserve baseline, hotter, drier, wetter, and combined hotter/drier cases. Keep existing public IDs `hotterAndDrier` and `hotter_drier` working through explicit adapters where needed. Earlier plans' `compound` is a descriptive case name unless a separate contract migration is assigned.
- Preserve public signatures, score outputs, daily-series behavior, baseline identity, and documented scenario limitations. Delete a module only after every distinct exported capability and caller is preserved. A forwarding compatibility export is acceptable.
- If reconciling the two algorithms would change scores or scientific semantics, report the concrete difference and obtain direction for that change. Finish independently safe consolidation within the assigned scope.

### Acceptance criteria

- All previous entry points continue to work. Daily-series and rotation-scoring regression tests verify unchanged outputs.
- A repository-wide search documents shared definitions, remaining adapters, and the reason for each retained module.
- Existing engine and climate scenario tests pass, with import adjustments only where required. The engine stays deterministic. Standard checks pass.

## Ticket 11 — Cross-feature regression coverage

### Approved files

- `src/tests/`, directly relevant new and existing test files

### Requirements

Complete the focused coverage introduced in earlier tickets.

- All four hubs and custom coordinates with external network calls mocked unavailable.
- Fixture validation and unchanged legacy JSON fields, metadata propagation, NDVI availability and annual trend behavior.
- Flood boundaries, bare-field boundaries, hand-calculated erosion results, and invalid scientific inputs.
- Request cancellation, stale-result rejection, A→B→A, delayed GPS, initial state, and failure recovery.
- Metric provenance and local review checklists in dashboard, comparison, print, and both languages.
- Recursive translation-key and placeholder parity.
- Farmer override precedence, reset, location-change reset, and provenance through the store/effective-soil path where overrides actually occur.
- Compatibility of both scenario APIs and cached payload handling at the changed boundaries.

Use existing test dependencies. When a test exposes a source bug, report the failing case and fix it through the relevant ticket's existing authorization. Any change beyond that scope requires developer direction. Soil classification changes and agronomic scoring changes require their own explicit scope.

### Acceptance criteria

- Default Vitest execution is CI-safe and deterministic with live integrations disabled.
- Tests verify observable behavior through normal service/store/rendering entry points.
- Standard checks pass and skipped opt-in live checks are identified.

## Ticket 12 — Documentation and submission preparation

### Approved files

- `README.md`
- `docs/DATA_SOURCES.md`
- `docs/METHODOLOGY.md`
- `docs/DEMO_SCRIPT.md`
- `docs/LOCAL_TESTING_GUIDE.md`

### Requirements

- Update outdated event-year statements to the supplied 2026 planning target while preserving genuine historical data periods and valid public URLs. Verify official challenge titles/rules before presenting submission eligibility or compliance.
- Keep FieldShift branding until the developer supplies a replacement. Use the repository URL established from project evidence. At merge time, `origin` points to `https://github.com/knet-the-traveller/Moon-Chanter`. Confirm at execution time and ask only if current evidence conflicts or the intended publication URL differs.
- Document all four hubs, the Malaybalay/bukidnon mapping, fixture shape, nearest-hub proxy behavior, data/source tiers, local workflow, and limitations.
- Explain NDVI availability, flood screening, bare-field assumptions, RUSLE formula/factors/units, rule IDs, and review status.
- Maintain a `Needs verification` list containing every unresolved scientific assumption, data gap, provisional translation, and submission claim, with the evidence or owner needed to resolve it.
- Describe outputs as advisory decision support. Explain uncertainty and avoid guaranteed agronomic outcomes or unsupported yield claims.
- Document reproducible install/run/test/build commands and actual offline behavior, including local-asset availability and GIBS tile limitations.

### Acceptance criteria

- A teammate can clone, install, run, test, and build using the documented steps.
- Documentation matches implemented behavior and observed check results.
- Relevant citations and verification gaps are visible. Standard checks pass.

## Ticket 13 — Final validation

### Scope

Run checks and manual QA. Report results without broadening implementation scope. Any fixes use the appropriate earlier ticket's authorization and verification requirements.

### Requirements

- Verify a reproducible install using the existing lockfile and `npm ci` in a disposable checkout/worktree or another suitable isolated copy carrying the completed work. Preserve the user's installed workspace. Request network escalation if the environment requires it.
- Run all four standard checks on the completed working tree and the clean installation. Record tool versions, command exit codes, test totals, skipped checks, build warnings, and differences between environments.
- With external telemetry blocked and local assets served, load the app and exercise all four hubs, custom coordinates, sample fallback, language switching, soil overrides, comparison, and printing.
- Separately record what happens when the application origin and assets are unavailable. State the observed offline capability. New offline app-shell infrastructure requires a separate assignment.
- Verify 360px layout, keyboard access, readable status labels, accessible headings, and print output. Record manual checks separately from automated checks.
- Scan tracked source/configuration for actual secrets and authentication requirements. Redact any detected credential material in reports. Verify private `.env` variants are untracked and `.env.example` contains placeholders only. Public Earthdata hostnames and benign configuration identifiers remain valid.
- List every outstanding `needsReview` item, owner-dependent decision, and QA limitation. Track engineering completion and scientific/submission review status separately.

### Acceptance criteria

- Standard checks pass with reproducible results, and all required manual QA has recorded evidence.
- All four hubs produce usable, accurately labeled land summaries with external data services unavailable.
- Active-location consistency, provenance, translations, print behavior, and existing scenario/soil behavior meet the preceding tickets' criteria.
- The final report identifies every file changed, checks and exact results, shared-contract changes, scientific review items, and pending work. Submission readiness remains pending until required scientific, product, and official-challenge reviews are resolved.
