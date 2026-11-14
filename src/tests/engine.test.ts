import { describe, it, expect } from 'vitest';
import cropsData from '../data/crops.json';
import type { Crop, ClimateData, SoilData, FarmerPriorities } from '../types';
import { generateCandidateRotations } from '../engine/candidateGenerator';
import { generateRotationRecommendations } from '../engine/index';
import { evaluateScenarios } from '../engine/scenarios';

const crops = cropsData as Crop[];

const mockSoil: SoilData = {
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

const mockClimate: ClimateData = {
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
  monthly: [
    { month: 'Jan', monthNum: 1, temp: 25.1, tempMax: 30.5, tempMin: 19.8, rainfall: 12, solarRadiation: 16.4, humidity: 74 },
    { month: 'Jul', monthNum: 7, temp: 27.9, tempMax: 32.0, tempMin: 23.8, rainfall: 365, solarRadiation: 15.8, humidity: 85 }
  ],
  heatStressDaysPerYear: 42,
  drySpellRisk: 'high',
  excessWaterRisk: 'high',
  heatRisk: 'high',
  tenYearRainfallTrend: 'decreasing',
  trendDeltaPercent: -4.8
};

const defaultPriorities: FarmerPriorities = {
  soilHealth: 50,
  waterResilience: 50,
  stableIncome: 50,
  lowInputCost: 50,
  lowLabor: 50,
  climateRisk: 50
};

describe('Rotation Engine Candidate Generator', () => {
  it('generates non-empty candidate sequences from Philippine crops dataset', () => {
    const candidates = generateCandidateRotations({
      allCrops: crops,
      soil: mockSoil
    });
    expect(candidates.length).toBeGreaterThan(5);
  });

  it('never puts the same crop in immediate consecutive seasons', () => {
    const candidates = generateCandidateRotations({
      allCrops: crops,
      soil: mockSoil
    });
    for (const cand of candidates) {
      expect(cand.s1Crop.id).not.toBe(cand.s2Crop.id);
      expect(cand.s2Crop.id).not.toBe(cand.s3Crop.id);
    }
  });

  it('strictly prevents consecutive Solanaceae crops to avoid bacterial wilt', () => {
    const candidates = generateCandidateRotations({
      allCrops: crops,
      soil: mockSoil
    });
    for (const cand of candidates) {
      const s1s2Solanaceae = cand.s1Crop.family === 'solanaceae' && cand.s2Crop.family === 'solanaceae';
      const s2s3Solanaceae = cand.s2Crop.family === 'solanaceae' && cand.s3Crop.family === 'solanaceae';
      expect(s1s2Solanaceae).toBe(false);
      expect(s2s3Solanaceae).toBe(false);
    }
  });

  it('respects excluded crops chosen by the farmer', () => {
    const candidates = generateCandidateRotations({
      allCrops: crops,
      soil: mockSoil,
      excludedCropIds: ['eggplant', 'tomato']
    });
    for (const cand of candidates) {
      expect(cand.s1Crop.id).not.toBe('eggplant');
      expect(cand.s2Crop.id).not.toBe('eggplant');
      expect(cand.s3Crop.id).not.toBe('eggplant');
      expect(cand.s1Crop.id).not.toBe('tomato');
      expect(cand.s2Crop.id).not.toBe('tomato');
      expect(cand.s3Crop.id).not.toBe('tomato');
    }
  });
});

describe('Recommendation Engine Scoring & Priorities', () => {
  it('shifts top-ranked plans when priority sliders change', () => {
    // Priorities emphasizing soil health vs low labor
    const soilPriorities: FarmerPriorities = {
      soilHealth: 100,
      waterResilience: 20,
      stableIncome: 10,
      lowInputCost: 10,
      lowLabor: 0,
      climateRisk: 20
    };

    const laborPriorities: FarmerPriorities = {
      soilHealth: 10,
      waterResilience: 20,
      stableIncome: 10,
      lowInputCost: 30,
      lowLabor: 100,
      climateRisk: 10
    };

    const soilPlans = generateRotationRecommendations({
      allCrops: crops,
      climate: mockClimate,
      soil: mockSoil,
      priorities: soilPriorities,
      maxResults: 5
    });

    const laborPlans = generateRotationRecommendations({
      allCrops: crops,
      climate: mockClimate,
      soil: mockSoil,
      priorities: laborPriorities,
      maxResults: 5
    });

    expect(soilPlans.length).toBeGreaterThanOrEqual(3);
    expect(laborPlans.length).toBeGreaterThanOrEqual(3);

    // The soil-focused plan top score should have high soil health score
    expect(soilPlans[0].scores.soilHealth).toBeGreaterThanOrEqual(70);
    // The labor-focused plan top score should have high labor score
    expect(laborPlans[0].scores.labor).toBeGreaterThanOrEqual(55);
  });

  it('generates explainable reasons citing rules and telemetry values', () => {
    const plans = generateRotationRecommendations({
      allCrops: crops,
      climate: mockClimate,
      soil: mockSoil,
      priorities: defaultPriorities,
      maxResults: 3
    });

    const topPlan = plans[0];
    expect(topPlan.reasons.length).toBeGreaterThanOrEqual(2);
    expect(topPlan.reasons[0].ruleId).toBeDefined();
    expect(topPlan.reasons[0].dataEvidence).toBeDefined();
    expect(topPlan.reasons[0].textEn.length).toBeGreaterThan(15);
    expect(topPlan.reasons[0].textFil.length).toBeGreaterThan(15);
  });
});

describe('Scenario Testing & Robustness Engine', () => {
  it('correctly evaluates baseline, hotter, drier, compound, and wetter scenarios', () => {
    const rice = crops.find((c) => c.id === 'rice')!;
    const mungbean = crops.find((c) => c.id === 'mungbean')!;
    const cowpea = crops.find((c) => c.id === 'cowpea')!;

    const evaluation = evaluateScenarios(
      { s1Crop: rice, s2Crop: mungbean, s3Crop: cowpea },
      mockClimate,
      mockSoil,
      defaultPriorities
    );

    expect(evaluation.scenarioScores.baseline).toBeGreaterThan(0);
    expect(evaluation.scenarioScores.hotter).toBeGreaterThan(0);
    expect(evaluation.scenarioScores.drier).toBeGreaterThan(0);
    expect(evaluation.scenarioScores.hotterAndDrier).toBeGreaterThan(0);
    expect(evaluation.scenarioScores.wetter).toBeGreaterThan(0);
    expect(['robust', 'moderate', 'vulnerable']).toContain(evaluation.robustness);
  });
});
