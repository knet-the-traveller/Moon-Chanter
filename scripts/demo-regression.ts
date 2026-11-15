import assert from 'node:assert/strict';
import { useAppStore } from '../src/store/useAppStore.ts';
import { PILOT_LOCATIONS } from '../src/data/pilotLocations.ts';
import { rankPlansForScenario } from '../src/engine/planRanking.ts';
import { generateRotationRecommendations } from '../src/engine/index.ts';
import cropsData from '../src/data/crops.json' with { type: 'json' };
import type { Crop, ScenarioCondition } from '../src/types/index.ts';

// Uses packaged scientific sources through the normal store. A request is a failure,
// not a silently accepted fallback. This script does not edit fixtures or caches on disk.
const originalFetch = globalThis.fetch;
const initial = useAppStore.getInitialState();
let requests = 0;
globalThis.fetch = async () => { requests++; throw new Error('Demo regression must stay offline'); };
try {
  for (const pilot of PILOT_LOCATIONS) {
    useAppStore.setState({ ...initial, useDemoAssumptions: false }, true);
    await useAppStore.getState().selectPilotPreset(pilot);
    const state = useAppStore.getState();
    assert(state.recommendedPlans.length > 0, `${pilot.id}: no plans`);
    assert(state.landSummary && !state.landSummary.isSample);
    for (const scenario of ['baseline','hotter','drier','hotterAndDrier','wetter'] satisfies ScenarioCondition[]) {
      const ranked = rankPlansForScenario(state.recommendedPlans, scenario);
      assert(ranked.at(-1)?.isBaseline);
      const adaptive = ranked.filter(plan => !plan.isBaseline);
      for (let i = 1; i < adaptive.length; i++) assert(adaptive[i-1].scenarioScores[scenario] >= adaptive[i].scenarioScores[scenario]);
    }
    console.log(`${pilot.id}: ${state.recommendedPlans.length} plans; SRTM ${state.landSummary.elevationM} m / ${state.landSummary.slopePct}%; accepted NDVI ${state.landSummary.ndvi.evidence?.accepted}/${state.landSummary.ndvi.evidence?.total}`);
  }
  await useAppStore.getState().selectPilotPreset(PILOT_LOCATIONS[0]);
  const original = useAppStore.getState().recommendedPlans;
  useAppStore.getState().setSoilOverride({ ph: 5.1 });
  const acidic = useAppStore.getState().recommendedPlans;
  const relay = original.find(plan => plan.seasons[1].crop.id === 'mungbean' && plan.seasons[2].crop.id === 'corn')!;
  const edited = acidic.find(plan => plan.id === relay.id)!;
  assert(edited.scores.soilHealth < relay.scores.soilHealth);
  assert(edited.scores.overall < relay.scores.overall);
  useAppStore.getState().resetSoilOverride();
  assert.deepEqual(useAppStore.getState().recommendedPlans.map(plan => plan.scores), original.map(plan => plan.scores));
  console.log(`Muñoz pH 5.1: relay soil ${relay.scores.soilHealth} → ${edited.scores.soilHealth}; fit ${relay.scores.overall} → ${edited.scores.overall}; reset restored source scores.`);

  const state = useAppStore.getState();
  assert(state.soilData && state.climateData);
  const syntheticSoil = { ...state.soilData, slopePct: 18, isEstimate: true, source: 'Synthetic QA steep-terrain scenario — not Malaybalay observations' };
  const syntheticPlans = generateRotationRecommendations({ allCrops: cropsData as Crop[], soil: syntheticSoil, climate: state.climateData, priorities: state.priorities, recentCropId: 'corn' });
  assert(syntheticPlans.some(plan => plan.name.en.startsWith('Upland Soil Armor')));
  assert(syntheticPlans.find(plan => plan.isBaseline)?.risks.some(risk => risk.textEn.includes('Fall Armyworm')));
  assert.equal(requests, 0);
  console.log('Synthetic 18% terrain: upland cover and corn-host warning verified separately; no real pilot terrain was replaced. Network requests: 0.');
} finally {
  globalThis.fetch = originalFetch;
  useAppStore.setState(initial, true);
}
