import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import cropsData from '../data/crops.json';
import type { Crop, FarmerPriorities } from '../types';
import { generateRotationRecommendations } from '../engine/index';
import { resolveBundledSoil } from '../services/bundledSoilGrids';
import { applyFarmerSoilOverride } from '../services/soilGrids';
import { PILOT_LOCATIONS } from '../data/pilotLocations';

const crops = cropsData as Crop[];

const defaultPriorities: FarmerPriorities = {
  soilHealth: 50,
  waterResilience: 50,
  stableIncome: 50,
  lowInputCost: 50,
  lowLabor: 50,
  climateRisk: 50
};

const presets = [
  { slug: 'munoz', id: 'munoz', name: 'Science City of Muñoz' },
  { slug: 'ilagan', id: 'ilagan', name: 'City of Ilagan' },
  { slug: 'pototan', id: 'pototan', name: 'Pototan' },
  { slug: 'malaybalay', id: 'bukidnon', name: 'Malaybalay City' }
] as const;

describe('End-to-End Municipal Preset Recommendation Viability', () => {
  it.each(presets)('produces non-empty rotation recommendations for $name using fixture soil', ({ slug }) => {
    const raw = JSON.parse(readFileSync(`public/sample-data/${slug}.json`, 'utf8'));
    expect(raw.soil).toBeDefined();
    expect(raw.climate).toBeDefined();

    const plans = generateRotationRecommendations({
      allCrops: crops,
      climate: raw.climate,
      soil: raw.soil,
      priorities: defaultPriorities,
      maxResults: 6
    });

    expect(plans.length).toBeGreaterThan(0);
    const topPlan = plans[0];
    expect(topPlan.seasons.length).toBeGreaterThanOrEqual(2);
    expect(topPlan.scores.overall).toBeGreaterThan(0);
    expect(topPlan.scenarioScores).toBeDefined();
    expect(topPlan.scenarioScores.baseline).toBeGreaterThan(0);
  });

  it.each(presets)('produces non-empty rotation recommendations for $name using bundled SoilGrids cell with local agronomic review', ({ id }) => {
    const pilotLoc = PILOT_LOCATIONS.find((loc) => loc.id === id);
    expect(pilotLoc).toBeDefined();

    const bundledSoil = resolveBundledSoil(pilotLoc!.lat, pilotLoc!.lon);
    expect(bundledSoil).not.toBeNull();
    expect(bundledSoil?.ph).not.toBeNull();
    if (!bundledSoil) throw new Error('bundledSoil not found');

    // ISRIC SoilGrids does not measure local field drainage or OM; local technician review provides these
    const effectiveSoil = applyFarmerSoilOverride(bundledSoil, {
      drainage: 'moderate',
      organicMatter: 'medium'
    });

    const slug = id === 'bukidnon' ? 'malaybalay' : id;
    const raw = JSON.parse(readFileSync(`public/sample-data/${slug}.json`, 'utf8'));

    const plans = generateRotationRecommendations({
      allCrops: crops,
      climate: raw.climate,
      soil: effectiveSoil,
      priorities: defaultPriorities,
      maxResults: 6
    });

    expect(plans.length).toBeGreaterThan(0);
    const topPlan = plans[0];
    expect(topPlan.seasons.length).toBeGreaterThanOrEqual(2);
    expect(topPlan.scores.overall).toBeGreaterThan(0);
    expect(topPlan.scenarioScores).toBeDefined();
    expect(topPlan.scenarioScores.baseline).toBeGreaterThan(0);
  });
});
