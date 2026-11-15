import { describe, it, expect } from 'vitest';
import { resolveBundledSoil } from '../services/bundledSoilGrids';
import cropsData from '../data/crops.json';
import type { Crop, ClimateData, SoilData, FarmerPriorities } from '../types';
import { generateCandidateRotations } from '../engine/candidateGenerator';
import { generateRotationRecommendations } from '../engine/index';
import { evaluateScenarios } from '../engine/scenarios';
import { calculateSequenceScores } from '../engine/scoring';
import { generatePlanExplanations } from '../engine/explainer';
import { assessSoilSuitability } from '../engine/soilSuitability';
import { rankPlansForScenario } from '../engine/planRanking';

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
  it.each([
    { texture: null }, { drainage: null }, { ph: null }, { ph: Number.NaN },
    { organicMatter: 'unknown' as const }
  ])('withholds candidates and rankings for incomplete soil: %j', missing => {
    const soil = { ...mockSoil, ...missing };
    expect(generateCandidateRotations({ allCrops: crops, soil })).toEqual([]);
    expect(generateRotationRecommendations({ allCrops: crops, climate: mockClimate, soil, priorities: defaultPriorities })).toEqual([]);
    const seq = generateCandidateRotations({ allCrops: crops, soil: mockSoil })[0];
    expect(() => calculateSequenceScores(seq, mockClimate, soil, defaultPriorities)).toThrow('Required soil inputs');
    expect(() => generatePlanExplanations(seq, mockClimate, soil)).toThrow('Required soil inputs');
  });
  it('generates non-empty candidate sequences from Philippine crops dataset', () => {
    const candidates = generateCandidateRotations({
      allCrops: crops,
      soil: mockSoil
    });
    expect(candidates.length).toBeGreaterThan(5);
  });

  it('never puts the same crop in immediate consecutive seasons for adaptive candidates', () => {
    const candidates = generateCandidateRotations({
      allCrops: crops,
      soil: mockSoil
    });
    for (const cand of candidates.filter((c) => !c.isBaseline)) {
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

describe('Strategy 1 Baseline Pinning & Canonical Philippine Rotations', () => {
  it('emits exactly the three shared planning periods without changing baseline pinning', () => {
    const plans = generateRotationRecommendations({allCrops: crops, climate: mockClimate, soil: mockSoil, priorities: defaultPriorities});
    expect(plans.some(plan => plan.isBaseline)).toBe(true);
    for (const plan of plans) {
      expect(plan.seasons.map(season => [season.seasonKey, season.periodMonths])).toEqual([
        ['wet', 'Jun – Oct'], ['dry_cool', 'Nov – Feb'], ['dry_hot', 'Mar – May']
      ]);
    }
  });

  it('keeps the strict >35 C rice threshold at the planning heat boundary', () => {
    const byId = (id: string) => crops.find(crop => crop.id === id)!;
    const sequence = {s1Crop: byId('rice'), s2Crop: byId('rice'), s3Crop: byId('fallow')};
    const atBoundary = {...mockClimate, seasonalStats: {...mockClimate.seasonalStats, dryHot: {...mockClimate.seasonalStats.dryHot, maxTemp: 35}}};
    const aboveBoundary = {...atBoundary, seasonalStats: {...atBoundary.seasonalStats, dryHot: {...atBoundary.seasonalStats.dryHot, maxTemp: 35.1}}};
    expect(calculateSequenceScores(sequence, aboveBoundary, mockSoil, defaultPriorities).climateRisk)
      .toBeLessThan(calculateSequenceScores(sequence, atBoundary, mockSoil, defaultPriorities).climateRisk);
  });
  it('pins lowland baseline (Continuous Double Rice-Fallow) and canonical adaptive rice rotations', () => {
    const candidates = generateCandidateRotations({
      allCrops: crops,
      soil: {
        ...mockSoil,
        texture: 'clay',
        drainage: 'poor',
        ph: 6.4,
        bulkDensityGcm3: 1.46
      }
    });

    const baseline = candidates.find((c) => c.isBaseline);
    expect(baseline).toBeDefined();
    expect(baseline?.s1Crop.id).toBe('rice');
    expect(baseline?.s2Crop.id).toBe('rice');
    expect(baseline?.s3Crop.id).toBe('fallow');

    const hasRelayMungCorn = candidates.some(
      (c) => !c.isBaseline && c.s1Crop.id === 'rice' && c.s2Crop.id === 'mungbean' && c.s3Crop.id === 'corn'
    );
    const hasOnionPreRiceMung = candidates.some(
      (c) => !c.isBaseline && c.s1Crop.id === 'rice' && c.s2Crop.id === 'onion' && c.s3Crop.id === 'mungbean'
    );
    expect(hasRelayMungCorn).toBe(true);
    expect(hasOnionPreRiceMung).toBe(true);
  });

  it('pins upland baseline (Continuous Upland Corn-Corn-Fallow) and adaptive sloping/acid rotations', () => {
    const uplandSoil: SoilData = {
      ...mockSoil,
      texture: 'clay_loam',
      drainage: 'well',
      ph: 4.9,
      slopePct: 22,
      phosphorusFixationRisk: 'high'
    };

    const candidates = generateCandidateRotations({
      allCrops: crops,
      soil: uplandSoil
    });

    const baseline = candidates.find((c) => c.isBaseline);
    expect(baseline).toBeDefined();
    expect(baseline?.s1Crop.id).toBe('corn');
    expect(baseline?.s2Crop.id).toBe('corn');
    expect(baseline?.s3Crop.id).toBe('fallow');

    const hasUplandConservation = candidates.some(
      (c) => !c.isBaseline && c.s1Crop.id === 'corn' && c.s2Crop.id === 'mungbean' && c.s3Crop.id === 'sweet_potato'
    );
    expect(hasUplandConservation).toBe(true);

    const plans = generateRotationRecommendations({
      allCrops: crops,
      climate: mockClimate,
      soil: uplandSoil,
      priorities: defaultPriorities,
      maxResults: 4
    });

    const baselinePlan = plans.find((p) => p.isBaseline);
    expect(baselinePlan).toBeDefined();
    const topAdaptive = plans.find((p) => !p.isBaseline);
    expect(topAdaptive).toBeDefined();
    expect(topAdaptive!.scores.overall).toBeGreaterThan(baselinePlan!.scores.overall);
  });
});

describe('Agronomic Rule Guardrails [AGRO-RULE-01..04]', () => {
  const byId = (id: string) => crops.find((c) => c.id === id)!;

  it('[AGRO-RULE-01-NFIX] describes potential nitrogen benefits without inventing a field amount', () => {
    const seq = { s1Crop: byId('rice'), s2Crop: byId('mungbean'), s3Crop: byId('corn') };
    const explainer = generatePlanExplanations(seq, mockClimate, mockSoil);
    const nfix = explainer.reasons.find((r) => r.ruleId === 'AGRO-RULE-01-NFIX');

    expect(nfix).toBeDefined();
    expect(nfix!.textEn).toContain('no field nitrogen amount');
    expect(nfix!.textEn).not.toMatch(/kg N|300–350/);
    expect(nfix!.textFil).toContain('walang tinatayang dami');
  });

  it('[AGRO-RULE-02-HEAT35] penalizes dry-season rice when NASA POWER dryHot Tmax > 35°C (spikelet sterility cliff)', () => {
    const doubleRice = { s1Crop: byId('rice'), s2Crop: byId('rice'), s3Crop: byId('fallow') };
    const relayMung = { s1Crop: byId('rice'), s2Crop: byId('mungbean'), s3Crop: byId('corn') };

    const coolDryClimate: ClimateData = {
      ...mockClimate,
      seasonalStats: {
        ...mockClimate.seasonalStats,
        dryHot: { precip: 340, avgTemp: 27.0, maxTemp: 33.2 }
      }
    };

    const hotRiceScores = calculateSequenceScores(doubleRice, mockClimate, mockSoil, defaultPriorities);
    const coolRiceScores = calculateSequenceScores(doubleRice, coolDryClimate, mockSoil, defaultPriorities);
    const relayScores = calculateSequenceScores(relayMung, mockClimate, mockSoil, defaultPriorities);

    expect(hotRiceScores.climateRisk).toBeLessThan(coolRiceScores.climateRisk);
    expect(hotRiceScores.climateRisk).toBeLessThan(relayScores.climateRisk);

    const explainer = generatePlanExplanations(doubleRice, mockClimate, mockSoil);
    const heatRisk = explainer.risks.find((r) => r.ruleId === 'AGRO-RULE-02-HEAT35');
    expect(heatRisk).toBeDefined();
    expect(heatRisk!.textEn).toMatch(/35°C|35\.6°C/);
    expect(heatRisk!.textEn).toContain('does not establish field sterility or yield loss');
    expect(heatRisk!.textEn).not.toMatch(/7%|April 10|May 30/);
  });

  it('[AGRO-RULE-03-PESTBREAK] penalizes consecutive Corn->Corn, Solanaceae->Solanaceae, and Onion->Onion and credits multi-family breaks', () => {
    const cornCornFallow = { s1Crop: byId('corn'), s2Crop: byId('corn'), s3Crop: byId('fallow') };
    const riceOnionMung = { s1Crop: byId('rice'), s2Crop: byId('onion'), s3Crop: byId('mungbean') };
    const eggplantTomatoMung = { s1Crop: byId('eggplant'), s2Crop: byId('tomato'), s3Crop: byId('mungbean') };
    const onionOnionMung = { s1Crop: byId('onion'), s2Crop: byId('onion'), s3Crop: byId('mungbean') };

    const cornMonoScores = calculateSequenceScores(cornCornFallow, mockClimate, mockSoil, defaultPriorities);
    const eggplantTomatoScores = calculateSequenceScores(eggplantTomatoMung, mockClimate, mockSoil, defaultPriorities);
    const onionMonoScores = calculateSequenceScores(onionOnionMung, mockClimate, mockSoil, defaultPriorities);
    const breakScores = calculateSequenceScores(riceOnionMung, mockClimate, mockSoil, defaultPriorities);

    expect(breakScores.soilHealth).toBeGreaterThan(cornMonoScores.soilHealth);
    expect(breakScores.soilHealth).toBeGreaterThan(eggplantTomatoScores.soilHealth);
    expect(breakScores.soilHealth).toBeGreaterThan(onionMonoScores.soilHealth);

    const cornExp = generatePlanExplanations(cornCornFallow, mockClimate, mockSoil);
    expect(cornExp.risks.some((r) => r.ruleId === 'AGRO-RULE-03-PESTBREAK' && /Fall Armyworm/i.test(r.textEn))).toBe(true);

    const solExp = generatePlanExplanations(eggplantTomatoMung, mockClimate, mockSoil);
    expect(solExp.risks.some((r) => r.ruleId === 'AGRO-RULE-03-PESTBREAK' && /Bacterial Wilt/i.test(r.textEn))).toBe(true);

    const alliumExp = generatePlanExplanations(onionOnionMung, mockClimate, mockSoil);
    expect(alliumExp.risks.some((r) => r.ruleId === 'AGRO-RULE-03-PESTBREAK' && /Purple Blotch/i.test(r.textEn))).toBe(true);

    const breakExp = generatePlanExplanations(riceOnionMung, mockClimate, mockSoil);
    expect(breakExp.reasons.some((r) => r.ruleId === 'AGRO-RULE-03-PESTBREAK')).toBe(true);
  });

  it('[AGRO-RULE-04-EROSION-ACID] penalizes bare fallow on sloping/acidic uplands and flags lime & compaction verification', () => {
    const uplandSoil: SoilData = {
      ...mockSoil,
      ph: 4.8,
      slopePct: 24,
      phosphorusFixationRisk: 'high'
    };
    const bareFallow = { s1Crop: byId('corn'), s2Crop: byId('corn'), s3Crop: byId('fallow') };
    const canopyCover = { s1Crop: byId('corn'), s2Crop: byId('mungbean'), s3Crop: byId('sweet_potato') };

    const bareScores = calculateSequenceScores(bareFallow, mockClimate, uplandSoil, defaultPriorities);
    const canopyScores = calculateSequenceScores(canopyCover, mockClimate, uplandSoil, defaultPriorities);

    expect(canopyScores.soilHealth).toBeGreaterThan(bareScores.soilHealth);
    expect(canopyScores.overall).toBeGreaterThan(bareScores.overall);

    const bareExp = generatePlanExplanations(bareFallow, mockClimate, uplandSoil);
    const erosionRisk = bareExp.risks.find((r) => r.ruleId === 'AGRO-RULE-04-EROSION-ACID');
    expect(erosionRisk).toBeDefined();
    expect(erosionRisk!.textEn).toMatch(/RUSLE|bare/i);
    expect(erosionRisk!.mitigationEn).toMatch(/lime|CaCO3/i);

    const canopyExp = generatePlanExplanations(canopyCover, mockClimate, uplandSoil);
    expect(canopyExp.reasons.some((r) => r.ruleId === 'AGRO-RULE-04-EROSION-ACID')).toBe(true);

    const compactedSoil: SoilData = {
      ...mockSoil,
      texture: 'clay',
      bulkDensityGcm3: 1.46
    };
    const lowlandExp = generatePlanExplanations(
      { s1Crop: byId('rice'), s2Crop: byId('mungbean'), s3Crop: byId('corn') },
      mockClimate,
      compactedSoil
    );
    expect(lowlandExp.risks.some((r) => /1\.46|plow-pan|compaction/i.test(r.textEn))).toBe(true);
  });

  it('keeps neutral sloping uplands free of false acid warnings and avoids slope erosion misattribution on flat acidic lowlands', () => {
    const neutralSloping: SoilData = {
      ...mockSoil,
      slopePct: 20,
      ph: 6.5,
      phosphorusFixationRisk: 'low'
    };
    const canopyCover = { s1Crop: byId('corn'), s2Crop: byId('mungbean'), s3Crop: byId('sweet_potato') };
    const neutralExp = generatePlanExplanations(canopyCover, mockClimate, neutralSloping);
    expect(neutralExp.reasons.some((r) => r.id === 'reason_erosion_armor')).toBe(true);
    expect(neutralExp.risks.some((r) => r.id === 'risk_acid_lime_verify')).toBe(false);

    const flatAcidicLowland: SoilData = {
      ...mockSoil,
      texture: 'clay',
      drainage: 'poor',
      slopePct: 2,
      ph: 5.2,
      phosphorusFixationRisk: 'high'
    };
    const doubleRice = { s1Crop: byId('rice'), s2Crop: byId('rice'), s3Crop: byId('fallow') };
    const flatExp = generatePlanExplanations(doubleRice, mockClimate, flatAcidicLowland);
    expect(flatExp.risks.some((r) => r.id === 'risk_erosion_acid_fallow')).toBe(false);
    expect(flatExp.risks.some((r) => r.id === 'risk_acid_lime_verify')).toBe(true);

    const plans = generateRotationRecommendations({
      allCrops: crops,
      climate: mockClimate,
      soil: flatAcidicLowland,
      priorities: defaultPriorities,
      maxResults: 4
    });
    const baselinePlan = plans.find((p) => p.isBaseline);
    expect(baselinePlan).toBeDefined();
    expect(baselinePlan!.seasons[2].role).not.toBe('Drought-Hardy Soil Cover');
    expect(baselinePlan!.seasons[2].role).toMatch(/Fallow/i);
  });

  it('propagates [AGRO-RULE-01..03] economic and climate adjustments cleanly', () => {
    const relayMung = { s1Crop: byId('rice'), s2Crop: byId('mungbean'), s3Crop: byId('corn') };
    const doubleRice = { s1Crop: byId('rice'), s2Crop: byId('rice'), s3Crop: byId('fallow') };
    const cornMono = { s1Crop: byId('corn'), s2Crop: byId('corn'), s3Crop: byId('fallow') };

    const relayScores = calculateSequenceScores(relayMung, mockClimate, mockSoil, defaultPriorities);
    const riceMonoScores = calculateSequenceScores(doubleRice, mockClimate, mockSoil, defaultPriorities);
    const cornMonoScores = calculateSequenceScores(cornMono, mockClimate, mockSoil, defaultPriorities);

    expect(relayScores.economics).toBeGreaterThan(riceMonoScores.economics);
    expect(relayScores.economics).toBeGreaterThan(cornMonoScores.economics);
    expect(relayScores.climateRisk).toBeGreaterThan(cornMonoScores.climateRisk);
  });
});


describe('AGRO-RULE-05-MODEL-SUPPORT: imported soil predictions', () => {
  const modelEvidence = resolveBundledSoil(16.975, 121.810)!.modelEvidence;
  it('does not turn imported 0–15 cm density into a subsoil compaction score or warning', () => {
    const sequence = { s1Crop: crops.find(crop => crop.id === 'rice')!,
      s2Crop: crops.find(crop => crop.id === 'rice')!, s3Crop: crops.find(crop => crop.id === 'fallow')! };
    const base = { ...mockSoil, texture: 'loam' as const, modelEvidence };
    const dense = { ...base, bulkDensityGcm3: 1.8 };
    expect(calculateSequenceScores(sequence, mockClimate, dense, defaultPriorities))
      .toEqual(calculateSequenceScores(sequence, mockClimate, base, defaultPriorities));
    expect(generatePlanExplanations(sequence, mockClimate, dense).risks.some(risk => risk.id === 'risk_plow_pan_compaction')).toBe(false);
    expect(generatePlanExplanations(sequence, mockClimate, { ...dense, modelEvidence: undefined }).risks
      .some(risk => risk.id === 'risk_plow_pan_compaction')).toBe(true);
  });
  it('requires terrain evidence before classifying model soil as sloping upland', () => {
    const soil = { ...mockSoil, ph: 4.7, drainage: 'well' as const, modelEvidence };
    const unknownTerrain = generateCandidateRotations({ allCrops: crops, soil });
    const flat = generateCandidateRotations({ allCrops: crops, soil: { ...soil, slopePct: 0 } });
    expect(unknownTerrain).toEqual(flat);
    const baseline = unknownTerrain.find(sequence => sequence.isBaseline)!;
    expect(calculateSequenceScores(baseline, mockClimate, soil, defaultPriorities))
      .toEqual(calculateSequenceScores(baseline, mockClimate, { ...soil, slopePct: 0 }, defaultPriorities));
    expect(generatePlanExplanations(baseline, mockClimate, soil).risks.some(risk => risk.id === 'risk_erosion_acid_fallow')).toBe(false);
    const sloping = generateCandidateRotations({ allCrops: crops, soil: { ...soil, slopePct: 20 } });
    expect(sloping.find(sequence => sequence.isBaseline)?.s1Crop.id).toBe('corn');
  });
});

describe('Ticket 10 rotation-score compatibility',()=>{
  it('freezes reviewed soil-fit comparison scores and preserves aliases for all 90 legacy candidates',async()=>{
    const legacy=(await import('./fixtures/scenarioLegacy.json')).default;
    const {createHash}=await import('node:crypto');
    const expected={
      munoz:'73b2d701b0ba4d44681e7617d48c02f8cdfef3ba0e0e07b301b45510c1028695',
      ilagan:'c0bb910bf33433da73c1be20f4b991cb6d2a90b358647092bb5b2986a76c3539',
      pototan:'e41e4830712ec429a457c76793825ffab1b79ee7174dc487339c81386b4111b7'
    };
    for(const [slug,hash] of Object.entries(expected)){
      const fixture=legacy[slug as keyof typeof legacy] as {soil:SoilData;climate:ClimateData};
      const candidates=generateCandidateRotations({allCrops:crops,soil:fixture.soil});
      expect(candidates).toHaveLength(30);
      const values=candidates.map(c=>{
        const result=evaluateScenarios(c,fixture.climate,fixture.soil,defaultPriorities);
        const {baseline,hotter,drier,hotterAndDrier,wetter}=result.scenarioScores;
        // Upstream adds aliases; compare the original public result shape.
        expect(result.scenarioScores.compound).toBe(hotterAndDrier);
        expect(result.scenarioScores.hotter_drier).toBe(hotterAndDrier);
        return {scenarioScores:{baseline,hotter,drier,hotterAndDrier,wetter},robustness:result.robustness,maxDegradation:result.maxDegradation};
      });
      expect(createHash('sha256').update(JSON.stringify(values)).digest('hex')).toBe(hash);
    }
  });
});

describe('Scoring consistency milestone [AGRO-RULE-06-SOIL-FIT]', () => {
  const crop = (id: string) => crops.find(value => value.id === id)!;
  const sequence = { s1Crop: crop('rice'), s2Crop: crop('mungbean'), s3Crop: crop('corn') };
  const planted = [sequence.s1Crop, sequence.s2Crop, sequence.s3Crop];
  const matchedSoil: SoilData = { ...mockSoil, ph: 6.4, drainage: 'moderate' };

  it('lowers the same sequence soil score when measured input leaves its catalog pH ranges, including capped-bonus plans', () => {
    const neutral = calculateSequenceScores(sequence, mockClimate, matchedSoil, defaultPriorities);
    const acidic = calculateSequenceScores(sequence, mockClimate, { ...matchedSoil, ph: 5.1 }, defaultPriorities);
    const alkaline = calculateSequenceScores(sequence, mockClimate, { ...matchedSoil, ph: 9 }, defaultPriorities);
    expect(acidic.soilHealth).toBeLessThan(neutral.soilHealth);
    expect(acidic.overall).toBeLessThanOrEqual(neutral.overall); // Whole-point normalization may tie.
    expect(alkaline.soilHealth).toBeLessThan(acidic.soilHealth);
    expect(acidic.waterResilience).toBe(neutral.waterResilience);
    expect(acidic.economics).toBe(neutral.economics); // No invented yield/price response.
  });

  it('penalizes drainage mismatch without changing nitrogen, price or labor attributes', () => {
    const matched = calculateSequenceScores(sequence, mockClimate, matchedSoil, defaultPriorities);
    const poor = calculateSequenceScores(sequence, mockClimate, { ...matchedSoil, drainage: 'poor' }, defaultPriorities);
    expect(poor.waterResilience).toBeLessThan(matched.waterResilience);
    expect(poor.overall).toBeLessThan(matched.overall);
    expect(poor.soilHealth).toBe(matched.soilHealth);
    expect(poor.labor).toBe(matched.labor);
  });

  it('accepts range endpoints and leaves missing crop pH ranges explicitly unassessed', () => {
    const mungbean = crop('mungbean');
    for (const ph of [mungbean.soilPref.minPh!, mungbean.soilPref.maxPh!]) {
      expect(assessSoilSuitability([mungbean], { ...matchedSoil, ph }).phConflicts).toEqual([]);
    }
    const unknown = { ...mungbean, soilPref: { ...mungbean.soilPref, minPh: undefined, maxPh: undefined } };
    const assessment = assessSoilSuitability([unknown], { ...matchedSoil, ph: 3 });
    expect(assessment.phPenalty).toBe(0);
    expect(assessment.phUnassessed).toEqual([unknown]);
    for (const range of [{ minPh: Number.NaN, maxPh: 7 }, { minPh: 8, maxPh: 7 }, { minPh: 0, maxPh: 7 }, { minPh: 5, maxPh: 15 }]) {
      const malformed = { ...mungbean, soilPref: { ...mungbean.soilPref, ...range } };
      expect(assessSoilSuitability([malformed], matchedSoil).phUnassessed).toEqual([malformed]);
    }
    expect(assessSoilSuitability([crop('fallow')], matchedSoil).drainagePenalty).toBe(0);
  });

  it('explains the same deductions without mutating the crop catalog or supplied soil', () => {
    const soil = { ...matchedSoil, ph: 5.1, drainage: 'poor' as const };
    const before = JSON.stringify({ soil, crops });
    const fit = assessSoilSuitability(planted, soil);
    const risk = generatePlanExplanations(sequence, mockClimate, soil).risks.find(item => item.ruleId === 'AGRO-RULE-06-SOIL-FIT');
    expect(risk?.textEn).toContain(`soil ${fit.phPenalty}, water ${fit.drainagePenalty}`);
    expect(risk?.textEn).toContain('uncalibrated');
    expect(JSON.stringify({ soil, crops })).toBe(before);
  });

  it('keeps scenario rankings immutable and deterministic, with benchmark baseline pinned last', () => {
    const plans = generateRotationRecommendations({ allCrops: crops, climate: mockClimate, soil: matchedSoil, priorities: defaultPriorities });
    const a = { ...plans[0], scenarioScores: { ...plans[0].scenarioScores, hotter: 60 } };
    const b = { ...plans[1], scenarioScores: { ...plans[1].scenarioScores, hotter: 90 } };
    const baseline = { ...plans.find(plan => plan.isBaseline)!, scenarioScores: { ...plans[0].scenarioScores, hotter: 100 } };
    const input = [a, b, baseline];
    const before = JSON.stringify(input);
    expect(rankPlansForScenario(input, 'hotter').map(plan => plan.id)).toEqual([b.id, a.id, baseline.id]);
    expect(JSON.stringify(input)).toBe(before);
    const tied = { ...b, scenarioScores: { ...b.scenarioScores, hotter: 60 } };
    expect(rankPlansForScenario([a, tied, baseline], 'hotter')[0]).toBe(a);
    for (const scenario of ['baseline', 'hotter', 'drier', 'compound', 'hotterAndDrier', 'hotter_drier', 'wetter'] as const) {
      const ordered = rankPlansForScenario(plans, scenario);
      expect(ordered.at(-1)?.isBaseline).toBe(true);
      const adaptive = ordered.filter(plan => !plan.isBaseline);
      for (let i = 1; i < adaptive.length; i++) expect(adaptive[i - 1].scenarioScores[scenario]).toBeGreaterThanOrEqual(adaptive[i].scenarioScores[scenario]);
    }
  });

  it('keeps the steep-terrain demonstration explicitly synthetic rather than changing Malaybalay observations', () => {
    const synthetic = { ...matchedSoil, slopePct: 18, source: 'Synthetic QA terrain scenario', isEstimate: true };
    const plans = generateRotationRecommendations({ allCrops: crops, climate: mockClimate, soil: synthetic, priorities: defaultPriorities, recentCropId: 'corn' });
    expect(plans.some(plan => plan.name.en.startsWith('Upland Soil Armor'))).toBe(true);
    const baseline = plans.find(plan => plan.isBaseline)!;
    expect(baseline.name.en).toContain('Upland Corn');
    expect(baseline.risks.some(risk => /Fall Armyworm/.test(risk.textEn))).toBe(true);
  });
});

it('does not infer upland terrain or an erosion bonus from non-model acidity without slope evidence', () => {
  const soil = { ...mockSoil, ph: 4.7, drainage: 'well' as const };
  const candidates = generateCandidateRotations({ allCrops: crops, soil });
  expect(candidates.find(sequence => sequence.isBaseline)?.s1Crop.id).toBe('rice');
  expect(candidates.some(sequence => sequence.planName?.en.startsWith('Upland Soil Armor'))).toBe(false);
  const sequence = candidates[0];
  expect(generatePlanExplanations(sequence, mockClimate, soil).reasons.some(reason => reason.id === 'reason_erosion_armor')).toBe(false);
});

it('does not attribute a supplied illustrative climate profile to NASA observations in explanation evidence', () => {
  const sequence = generateCandidateRotations({ allCrops: crops, soil: mockSoil })[0];
  const explanation = generatePlanExplanations(sequence, { ...mockClimate, isSampleData: true, source: 'Illustrative climate example' }, mockSoil);
  expect(explanation.reasons.map(reason => reason.dataEvidence).join(' ')).not.toContain('NASA POWER');
});
