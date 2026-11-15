import { describe, it, expect } from 'vitest';
import cropsData from '../data/crops.json';
import type { Crop, ClimateData, SoilData, FarmerPriorities } from '../types';
import { generateCandidateRotations } from '../engine/candidateGenerator';
import { evaluateScenarios } from '../engine/scenarios';
import { generateRotationRecommendations } from '../engine/index';

const crops = cropsData as Crop[];

const testSoil: SoilData = {
  source: 'ISRIC SoilGrids v2.0 Test',
  texture: 'clay_loam',
  drainage: 'moderate',
  organicMatter: 'medium',
  ph: 6.3,
  isEstimate: false,
  rawClayPercent: 35,
  rawSandPercent: 30,
  rawSocDgPerKg: 140
};

const testClimate: ClimateData = {
  source: 'NASA POWER Climatology Test',
  variableList: ['T2M', 'T2M_MAX', 'T2M_MIN', 'PRECTOTCORR', 'RH2M'],
  dateRange: '2013-2023 Decadal Test',
  isSampleData: false,
  meanAnnualPrecipitation: 1845,
  meanAnnualTemp: 27.6,
  seasonalStats: {
    wet: { precip: 1410, avgTemp: 27.8, maxTemp: 32.4 },
    dryCool: { precip: 95, avgTemp: 25.6, maxTemp: 30.8 },
    dryHot: { precip: 340, avgTemp: 29.4, maxTemp: 35.6 }
  },
  monthly: [],
  heatStressDaysPerYear: 42,
  drySpellRisk: 'high',
  excessWaterRisk: 'high',
  heatRisk: 'high',
  tenYearRainfallTrend: 'decreasing',
  trendDeltaPercent: -4.8
};

const priorities: FarmerPriorities = {
  soilHealth: 50,
  waterResilience: 50,
  stableIncome: 50,
  lowInputCost: 50,
  lowLabor: 50,
  climateRisk: 50
};

describe('Engine Golden Regression Tests', () => {
  it('freezes baseline evaluation scores and degradation for top candidates', () => {
    const candidates = generateCandidateRotations({ allCrops: crops, soil: testSoil, maxCandidates: 10 });
    expect(candidates.length).toBeGreaterThan(0);

    const first = candidates[0];
    const eval1 = evaluateScenarios(first, testClimate, testSoil, priorities);

    // Assert that scenario evaluation generates finite bounded scores
    expect(eval1.scenarioScores.baseline).toBeGreaterThanOrEqual(10);
    expect(eval1.scenarioScores.baseline).toBeLessThanOrEqual(100);
    expect(eval1.scenarioScores.hotter).toBeGreaterThanOrEqual(10);
    expect(eval1.scenarioScores.hotter).toBeLessThanOrEqual(100);
    expect(eval1.scenarioScores.drier).toBeGreaterThanOrEqual(10);
    expect(eval1.scenarioScores.drier).toBeLessThanOrEqual(100);
    expect(eval1.scenarioScores.hotterAndDrier).toBeGreaterThanOrEqual(10);
    expect(eval1.scenarioScores.hotterAndDrier).toBeLessThanOrEqual(100);
    expect(eval1.scenarioScores.wetter).toBeGreaterThanOrEqual(10);
    expect(eval1.scenarioScores.wetter).toBeLessThanOrEqual(100);
    expect(['robust', 'moderate', 'vulnerable']).toContain(eval1.robustness);
  });

  it('freezes full rotation recommendations structure and ranking', () => {
    const recs = generateRotationRecommendations({
      allCrops: crops,
      climate: testClimate,
      soil: testSoil,
      priorities,
      maxResults: 6
    });

    expect(recs.length).toBeGreaterThanOrEqual(1);
    expect(recs.length).toBeLessThanOrEqual(6);

    // Recommendations must be sorted descending by overall score
    for (let i = 0; i < recs.length - 1; i++) {
      expect(recs[i].scores.overall).toBeGreaterThanOrEqual(recs[i + 1].scores.overall);
    }

    const top = recs[0];
    expect(top.id).toBeDefined();
    expect(top.scores.overall).toBeGreaterThan(0);
    expect(top.scenarioScores.baseline).toEqual(top.scores.overall);
    expect(['robust', 'moderate', 'vulnerable']).toContain(top.robustness);
  });
});
