import type { CandidateSequence } from './candidateGenerator';
import type { ClimateData, FarmerPriorities, ScenarioCondition, SoilData } from '../types';
import { scenarioAdjustment } from '../config/pilot';
import { calculateSequenceScores } from './scoring';

export interface ScenarioEvaluation {
  scenarioScores: Record<ScenarioCondition, number>;
  robustness: 'robust' | 'moderate' | 'vulnerable';
  maxDegradation: number;
}

export function evaluateScenarios(
  seq: CandidateSequence,
  baseClimate: ClimateData,
  soil: SoilData,
  priorities: FarmerPriorities
): ScenarioEvaluation {
  const hotterAdjustment = scenarioAdjustment('hotter');
  const drierAdjustment = scenarioAdjustment('drier');
  const wetterAdjustment = scenarioAdjustment('wetter');

  // 1. Baseline
  const baseScores = calculateSequenceScores(seq, baseClimate, soil, priorities);
  const baseline = baseScores.overall;

  // 2. Hotter (+1.5°C)
  const hotterClimate: ClimateData = {
    ...baseClimate,
    seasonalStats: {
      wet: { ...baseClimate.seasonalStats.wet, maxTemp: baseClimate.seasonalStats.wet.maxTemp + hotterAdjustment.temperatureDeltaC },
      dryCool: { ...baseClimate.seasonalStats.dryCool, maxTemp: baseClimate.seasonalStats.dryCool.maxTemp + hotterAdjustment.temperatureDeltaC },
      dryHot: { ...baseClimate.seasonalStats.dryHot, maxTemp: baseClimate.seasonalStats.dryHot.maxTemp + hotterAdjustment.temperatureDeltaC }
    },
    heatRisk: 'high',
    heatStressDaysPerYear: baseClimate.heatStressDaysPerYear + 18
  };
  const hotterScores = calculateSequenceScores(seq, hotterClimate, soil, priorities);
  // Penalize crops with low heat tolerance
  let hotterDelta = 0;
  [seq.s1Crop, seq.s2Crop, seq.s3Crop].forEach((c) => {
    if (c.heatTolerance === 'low') hotterDelta -= 9;
    else if (c.heatTolerance === 'medium') hotterDelta -= 3;
    else hotterDelta += 2;
  });
  const hotter = Math.min(100, Math.max(10, hotterScores.overall + hotterDelta));

  // 3. Drier (-15% Rainfall)
  const drierClimate: ClimateData = {
    ...baseClimate,
    meanAnnualPrecipitation: Math.round(baseClimate.meanAnnualPrecipitation * drierAdjustment.rainfallMultiplier),
    seasonalStats: {
      wet: { ...baseClimate.seasonalStats.wet, precip: Math.round(baseClimate.seasonalStats.wet.precip * drierAdjustment.rainfallMultiplier) },
      dryCool: { ...baseClimate.seasonalStats.dryCool, precip: Math.round(baseClimate.seasonalStats.dryCool.precip * drierAdjustment.rainfallMultiplier) },
      dryHot: { ...baseClimate.seasonalStats.dryHot, precip: Math.round(baseClimate.seasonalStats.dryHot.precip * drierAdjustment.rainfallMultiplier) }
    },
    drySpellRisk: 'high'
  };
  const drierScores = calculateSequenceScores(seq, drierClimate, soil, priorities);
  let drierDelta = 0;
  [seq.s1Crop, seq.s2Crop, seq.s3Crop].forEach((c) => {
    if (c.droughtTolerance === 'high') drierDelta += 3;
    else if (c.droughtTolerance === 'low') drierDelta -= 10;

    if (c.waterDemand === 'high') drierDelta -= 8;
  });
  const drier = Math.min(100, Math.max(10, drierScores.overall + drierDelta));

  // 4. Hotter + Drier (Compound Shock)
  const hotterAndDrier = Math.min(
    100,
    Math.max(10, Math.round(baseline - Math.abs(baseline - hotter) * 0.8 - Math.abs(baseline - drier) * 0.85))
  );

  // 5. Wetter (+15% Intense Rainfall & Flash Flood Risk)
  const wetterClimate: ClimateData = {
    ...baseClimate,
    meanAnnualPrecipitation: Math.round(baseClimate.meanAnnualPrecipitation * wetterAdjustment.rainfallMultiplier),
    seasonalStats: {
      wet: { ...baseClimate.seasonalStats.wet, precip: Math.round(baseClimate.seasonalStats.wet.precip * wetterAdjustment.rainfallMultiplier) },
      dryCool: { ...baseClimate.seasonalStats.dryCool, precip: Math.round(baseClimate.seasonalStats.dryCool.precip * wetterAdjustment.rainfallMultiplier) },
      dryHot: { ...baseClimate.seasonalStats.dryHot, precip: Math.round(baseClimate.seasonalStats.dryHot.precip * wetterAdjustment.rainfallMultiplier) }
    },
    excessWaterRisk: 'high'
  };
  const wetterScores = calculateSequenceScores(seq, wetterClimate, soil, priorities);
  let wetterDelta = 0;
  // If S1 has low flood tolerance, heavy penalty
  if (seq.s1Crop.floodTolerance === 'low') wetterDelta -= 16;
  else if (seq.s1Crop.floodTolerance === 'high') wetterDelta += 6;

  const wetter = Math.min(100, Math.max(10, wetterScores.overall + wetterDelta));

  const minScenarioScore = Math.min(baseline, hotter, drier, hotterAndDrier, wetter);
  const maxDegradation = baseline - minScenarioScore;

  let robustness: 'robust' | 'moderate' | 'vulnerable' = 'moderate';
  if (maxDegradation <= 12 && minScenarioScore >= 68) {
    robustness = 'robust';
  } else if (maxDegradation > 22 || minScenarioScore < 52) {
    robustness = 'vulnerable';
  }

  return {
    scenarioScores: {
      baseline,
      hotter,
      drier,
      hotterAndDrier,
      wetter
    },
    robustness,
    maxDegradation
  };
}
