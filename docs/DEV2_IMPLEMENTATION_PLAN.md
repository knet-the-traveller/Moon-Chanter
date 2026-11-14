# Dev 2 Implementation Overview and Merge Decisions

The executable handoff is [DEV2_TICKETED_IMPLEMENTATION.md](DEV2_TICKETED_IMPLEMENTATION.md). Root [AGENTS.md](../AGENTS.md) contains the standing repository rules. This overview records context, scope, and decisions from the instruction merge requested on November 14, 2026.

Use the ticketed handoff's current numbers and dependency order for future assignments. Earlier feature numbers and attachment ticket numbers have changed during reconciliation. Implementation begins when the developer assigns a ticket.

## Sources compared

- Repository `AGENTS.md` and revised attachment `/Users/hanzel/Downloads/AGENTS-3.md`.
- Repository `docs/DEV2_TICKETED_IMPLEMENTATION.md` and revised attachment `/Users/hanzel/Downloads/DEV2_TICKETED_IMPLEMENTATION-2.md`.
- Repository `docs/DEV2_IMPLEMENTATION_PLAN.md` for workstream context and requirements missing from either ticket draft.
- Current source, fixtures, package scripts, and local Git metadata to identify instructions that conflicted with the checkout.

The attached documents were reviewed as proposed instruction content. Their commands to implement tickets, create branches, commit, or reinstall dependencies apply only to later authorized assignments.

## Retained scope

Dev 2 owns the land/terrain data workflow and its map/presentation integration.

- A compatible LandSummary contract with terrain, vegetation, bare-field months, flood screening, RUSLE estimate, provenance, and sample/review metadata.
- Consistent municipal land fixture extensions for Science City of Muñoz, Ilagan, Pototan, and Malaybalay.
- Deterministic, documented land helpers and a resilient fixture-based service.
- Location changes through a shared store pipeline, with cancellation and stale-response protection.
- Source/variable/resolution/date labels and local review checklists across dashboard, comparison, and print views.
- Compatible scenario consolidation where the current APIs actually overlap, coordinated with the shared owner.
- Focused tests, cross-feature regression checks, documentation, and final QA.

The original overview also mentioned three-season rotation requirements, a rice anthesis heat threshold, and baseline pinning. Preserve existing behavior and report any gaps during the audit. Scoring, heat-response calibration, rotation candidate generation, and baseline-policy changes require a separately assigned engine task with scientific evidence and tests. Dev 2 checklist and scenario wiring authorization covers their stated presentation/compatibility scope.

## Reconciliation decisions

| Topic | Gaps or conflict in the supplied versions | Merged decision |
| --- | --- | --- |
| Standing rules | The old rules lacked zero-auth task conventions, provenance, review status, and ticket-specific authorization. The revision added these but referenced a missing ticket path. | Preserve the original safeguards and adopt the revised conventions using `docs/DEV2_TICKETED_IMPLEMENTATION.md` everywhere. |
| Authorization | The old rules required repeated confirmation for protected paths. The revision treated a named ticket as approval without distinguishing review from execution. | An explicit implementation assignment authorizes its named scope. A planning merge keeps implementation pending. |
| Execution order | Earlier drafts built a complete service before its fixtures and risk helpers. The revision still placed the service before the final rules. | Contract → fixtures → NDVI → flood helper → bare-field/RUSLE helpers → complete service → map/UI. Each ticket can finish in a buildable state. |
| Existing work | The old draft grouped features. The revision required a new branch and commit per ticket. | One assigned ticket at a time on the assigned non-main branch/worktree. Preserve user changes. Branch-per-ticket, commits, and pushes follow explicit assignment requirements. |
| Tests and file lists | Tests were deferred to Ticket 11 even when earlier acceptance criteria required them. Several UI lists omitted translations. | Every behavior ticket includes focused tests. UI tickets include both translation files. Ticket 11 adds cross-feature coverage. |
| Fixture immutability | The old rules prohibited fixture changes. The revision allowed additions but required a flat uniform schema that conflicts with existing nested JSON. | Preserve every old value and add a common validated `land` extension beside existing blocks. Require consistency for the consumed extension. |
| Malaybalay | The revision assumed fixture filenames matched preset IDs. | Keep preset ID `bukidnon` and fixture filename `malaybalay.json` compatible through explicit mapping. |
| Synchronous fallback builder | The revised two-argument builder assumed fixture data would already be synchronously available. Existing fixtures are served from `public/`. | Pass validated fixtures to the pure builder explicitly. The async service owns bounded local loading and validation. |
| Scientific values | The old plan accepted realistic sample values. The revision added `needsReview`, with ambiguous instructions for primitive constants and JSON comments. | Mark synthetic examples explicitly, attach typed review metadata or JSON notes, and propagate uncertainty to derived outputs. Keep observation dates, retrieval dates, and fixture creation dates distinct. |
| NDVI trend | Both drafts requested a trend from monthly profiles without defining comparable observations across years. | Use dated annual/comparable observations for per-year OLS. Monthly climatology supplies seasonal means. Unsupported trends carry an unavailable reason alongside the compatibility zero. |
| Flood and erosion | The original rules were vague. The revision supplied example thresholds and an unspecified NDVI-to-C mapping. | Retain explicit rule IDs and proposed thresholds as review-marked assumptions. Require documented factors, compatible units, a justified or clearly illustrative C mapping, and boundary tests. |
| Risk classifications | The overview suggested slope/erosion severity bands without a defined erosion threshold. | Produce the requested continuous erosion estimate. Additional severity thresholds need a documented, assigned basis. |
| Caching | Both drafts described a seven-day localStorage pattern as already present. The checkout uses multiple storage tiers and a 30-day default/configuration. GIBS uses tile URLs. | Preserve storage fallbacks, explicitly align applicable JSON TTLs in Ticket 6, and report actual tile caching separately. |
| Location consistency | The old draft omitted races. The revision guarded only the land result and relied on location comparison. | Use request identity for land and associated climate/soil commits, including A→B→A and delayed GPS cases. Preserve existing action callers. |
| Provenance | Original example labels used fixed resolution/date claims. The revision improved verification but omitted source/contract files needed to carry actual metadata. | Permit additive metadata through the relevant contracts/services. Centralize formatting while deriving dynamic labels from consumed data. Verify product claims during implementation. |
| Soil override | Draft tests referred to override behavior as service logic. Current overrides merge in Zustand. | Test actual store/effective-soil behavior and preserve precedence, reset, and classification. Label overrides accurately. |
| Checklist localization | Drafts placed checklist text in the engine while requiring every UI string in translation JSON. | Generate deterministic descriptors in the explainer and resolve shared translation keys in presentation code. |
| Scenario consolidation | Both drafts assumed the two modules were duplicates. They have different inputs, outputs, and compound-case IDs. | Consolidate verified overlap and preserve daily-series and rotation-scoring APIs with explicit adapters. Retain modules when they represent distinct capabilities. |
| Naming and dates | The old overview requested removal of FieldShift naming without a replacement. Drafts also required removal of all 2024/Earthdata references. | Preserve current branding, historical observation dates, and public Earthdata hostnames. Correct outdated event/authentication claims and verify official submission details. |
| Repository URL | The revision required asking whenever the prompt omitted the URL. | Inspect project evidence first. Current origin provides a candidate URL. Ask when the intended publication target remains ambiguous. |
| Final install and scanning | The revision prescribed deleting workspace dependencies and searching for zero mentions of tokens/keys/Earthdata. | Verify a lockfile-based clean install in an isolated copy and scan for actual credential/authentication problems with redacted reporting. |
| Offline readiness | Drafts conflated unavailable external telemetry with fully offline application loading. | Test external-service failure while local assets are served, and separately record app-origin/asset availability. Document observed capabilities. |
| Completion reporting | The old rules required fixing every failure even when unrelated. The revision added detailed review reporting. | Run all required checks, fix task regressions within scope, and record pre-existing failures and pending scientific/manual checks honestly. |
| Compiler enforcement | The root config references two projects, and neither project explicitly enabled strict mode during review. The standard build alone left this requirement unverified. | Check effective options for both projects and run explicit `--strict --noEmit` checks where strict mode is absent. Keep compiler-configuration changes within an assigned task. |
| Translation parameters | The plan referred to translating descriptor parameters, while the current `getTranslation` function accepts only language and path. | Retrieve the translated template with the existing two-argument API and format typed parameters after lookup. Verify placeholder parity. |
| Duplicate instructions | `docs/ai-system/ai-rules.md` copied the old root rules and could drift after the merge. | Replace the duplicate with a pointer to root AGENTS.md. Keep the ticketed handoff authoritative for execution order. |

## Checkout evidence used for this merge

These observations describe the inspected checkout. Ticket 0 must confirm them again before implementation.

- Active branch was `dev2-satellite`. Both Dev 2 plan documents were already untracked, and `.DS_Store` was also untracked.
- `origin` was `https://github.com/knet-the-traveller/Moon-Chanter`. README used a different clone URL.
- Three municipal fixtures existed under `public/sample-data/`. Malaybalay's fixture was absent. All four presets existed, with Malaybalay under ID `bukidnon`.
- Existing municipal JSON used `location`, `climate`, and `soil` blocks. `nasa-power-pilot.json` is a separate climate sample asset.
- `src/types/contracts.ts` contained ClimateSummary. UI/store types including ClimateData, SoilData, and ScenarioCondition lived in `src/types/index.ts`. LandSummary was absent.
- `getTranslation` was the existing translation function. The source inspection found no existing Zod schema declarations in `src/` to extend for the new land fixtures.
- CacheService exposed `get`, `set`, `getSync`, and `clear`, plus the LocalCacheService alias. Its default TTL and pilot API TTL configuration were 30 days.
- GIBS configuration provided public WMTS URLs to Leaflet. Its observation date included a genuine historical date, which needs accurate display and provenance.
- Scenario IDs included `hotterAndDrier` in rotation/UI types and `hotter_drier` in daily-series helpers. Existing tests and a climate-demo script used the respective APIs.
- Soil overrides were applied in Zustand before recommendation generation. The current nearest soil-sample helper supported only three municipal slugs, which the audit should record as an existing integration gap.
- Package scripts provided `test`, `lint`, and `build`. The build script ran `tsc -b` and Vite. Live integration testing was opt-in through `RUN_LIVE_TESTS`.

## Decisions remaining for implementation

- Scientific sources and validation for added terrain/NDVI/RUSLE values, flood thresholds, fallow windows, the cover-factor mapping, and any qualitative severity bands.
- Availability of dated observations supporting an interannual NDVI trend.
- Dev 1 coordination and any behavior-changing reconciliation between scenario APIs.
- Any required changes to existing crop/preset values, soil classification, rotation scoring, rice heat-response rules, or baseline policy.
- Native-speaker review of new Filipino wording and verification of official challenge/submission claims.

An unresolved item should identify its effect and owner/evidence needed. Proceed with independent authorized work while preserving accurate review status.

## Verification of the documentation merge

The following commands ran against the inspected checkout on November 14, 2026.

| Command | Exit code | Observed result |
| --- | --- | --- |
| `npm test` | 0 | 5 test files passed, 1 skipped. 24 tests passed, 1 skipped. The live integration test is opt-in. |
| `npx tsc -b` | 0 | Completed without diagnostics. |
| `npm run lint` | 0 | Four existing warnings, listed below. |
| `npm run build` | 0 | Production build succeeded. Existing warnings covered browser externalization of `node:path` and `node:fs` from `src/services/nasaPower.ts`, plus a minified JavaScript chunk above 500 kB. |
| `git diff --check` | 0 | Tracked changes passed whitespace checks. |
| Inline Python documentation checks | 0 | All four edited documents passed local-link, code-fence, whitespace, and canonical ticket-path checks. Ticket headings ran consecutively from 0 through 13. |

Lint warnings occurred at `src/components/PrintablePlan.tsx` lines 20 and 45 for render purity, `src/App.tsx` line 38 for effect dependencies, and `src/components/MapPicker.tsx` line 92 for effect dependencies. Their source files have no edits from this documentation task.

The merged files are `AGENTS.md`, `docs/DEV2_TICKETED_IMPLEMENTATION.md`, `docs/DEV2_IMPLEMENTATION_PLAN.md`, and `docs/ai-system/ai-rules.md`. The two Dev 2 documents already had untracked status before editing. Scientific-source verification, feature implementation, a clean-install exercise, and browser/manual QA belong to the future assigned tickets.

## Follow-up instruction review

The follow-up review on November 14, 2026 clarified instruction precedence, direct-task authorization, and authorization for an assigned sequence of tickets. The `ai-rules.md` entry point now explicitly requires reading root `AGENTS.md` and limits the Dev 2 links to that workstream. Root architecture guidance distinguishes shared state, local presentation state, services, and engine calculations. Accessibility guidance uses native semantics with ARIA supplementation where needed.

Effective configurations inspected with `npx tsc --showConfig -p tsconfig.app.json` and `npx tsc --showConfig -p tsconfig.node.json` omitted an explicit strict setting. Both commands exited 0. Root rule 17 and the ticket handoff now require the relevant explicit strict checks until the project configurations enforce strict mode. Both `npx tsc -p tsconfig.app.json --strict --noEmit` and `npx tsc -p tsconfig.node.json --strict --noEmit` exited 0 with no diagnostics. Configuring the strict option remains a scoped implementation follow-up.

The review also corrected translation-parameter handling to match the existing two-argument API, confined validation requirements to new consumers or changed parsing/structures, preserved narrow TTL/import assignments, and distinguished clean checks from checks with existing warnings.

Verification was rerun after the rule updates. `npm test` exited 0 with 24 tests passed and 1 skipped. `npx tsc -b` exited 0 without diagnostics. `npm run lint` exited 0 with the same four existing warnings listed above. `npm run build` exited 0 with the same browser-externalization and chunk-size warnings. Explicit strict checks and the build ran sequentially. Documentation checks confirmed local links, code fences, whitespace, canonical ticket paths, rules 1–27, tickets 0–13, and matching verification commands. `git diff --check` exited 0.
