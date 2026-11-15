import type { CandidateSequence } from './candidateGenerator';
import type { ClimateData, FarmerPriorities, ScenarioCondition, SoilData, WaterSource } from '../types';
import type { DailySeries } from '../services/nasaPower';
import type { ClimateSummary } from '../types/contracts';
import { PILOT_CONFIG } from '../config/pilot';
import { calculateSequenceScores } from './scoring';
import { calculateClimateSummary } from './climate/climateSummary';

export type CanonicalScenarioId = 'baseline' | 'hotter' | 'drier' | 'compound' | 'wetter';
export type ClimateScenarioId = CanonicalScenarioId | 'hotter_drier' | 'hotterAndDrier';
export type { ScenarioCondition };

export interface ScenarioDeltas {
  hotterTempDeltaC?: number;
  drierPrecipMultiplier?: number;
  wetterPrecipMultiplier?: number;
}

export interface ScenarioEvaluation {
  scenarioScores: Record<ScenarioCondition, number>;
  robustness: 'robust' | 'moderate' | 'vulnerable';
  maxDegradation: number;
}

/**
 * Pure function: Apply a climate scenario transformation to a DailySeries.
 * 
 * IMPORTANT METHODOLOGICAL LIMITATION:
 * Scaling daily precipitation by a constant factor (0.85 or 1.15) alters cumulative
 * rainfall volumes and threshold crossings, but preserves rainfall occurrence timing
 * and dry-spell sequence structure. Consequently, dry-spell durations under scenarios
 * are sensitivity approximations, not dynamical weather forecasts.
 */
export function applyScenario(
  series: DailySeries,
  scenario: ClimateScenarioId,
  deltas?: ScenarioDeltas
): DailySeries {
  if (scenario === 'baseline') {
    return series;
  }

  const hotterDelta = deltas?.hotterTempDeltaC ?? PILOT_CONFIG.scenarios.hotterTempDeltaC;
  const drierMultiplier = deltas?.drierPrecipMultiplier ?? PILOT_CONFIG.scenarios.drierPrecipMultiplier;
  const wetterMultiplier = deltas?.wetterPrecipMultiplier ?? PILOT_CONFIG.scenarios.wetterPrecipMultiplier;

  let tempShift = 0;
  let rainMultiplier = 1.0;

  switch (scenario) {
    case 'hotter':
      tempShift = hotterDelta;
      break;
    case 'drier':
      rainMultiplier = drierMultiplier;
      break;
    case 'wetter':
      rainMultiplier = wetterMultiplier;
      break;
    case 'compound':
    case 'hotter_drier':
    case 'hotterAndDrier':
      tempShift = hotterDelta;
      rainMultiplier = drierMultiplier;
      break;
  }

  const transformedT2m = series.t2m.map((t) => (t !== null ? Number((t + tempShift).toFixed(2)) : null));
  const transformedT2mMax = series.t2mMax.map((tm) => (tm !== null ? Number((tm + tempShift).toFixed(2)) : null));
  const transformedPrecip = series.prectotcorr.map((p) =>
    p !== null ? Number((Math.max(0, p * rainMultiplier)).toFixed(2)) : null
  );

  return {
    ...series,
    t2m: transformedT2m,
    t2mMax: transformedT2mMax,
    ...(series.t2mMin ? { t2mMin: series.t2mMin.map((t) => (t === null ? null : Number((t + tempShift).toFixed(2)))) } : {}),
    prectotcorr: transformedPrecip,
    source: `${series.source} [Scenario: ${scenario}]`
  };
}

/**
 * Pure function: Summarize daily series across all canonical scenarios.
 * Returns a Record<CanonicalScenarioId, ClimateSummary> (also keyed with backwards-compatible aliases).
 */
export function summarizeAllScenarios(
  series: DailySeries,
  deltas?: ScenarioDeltas
): Record<CanonicalScenarioId, ClimateSummary> & { hotter_drier?: ClimateSummary; hotterAndDrier?: ClimateSummary } {
  const scenarioIds: CanonicalScenarioId[] = ['baseline', 'hotter', 'drier', 'compound', 'wetter'];
  const results: Record<string, ClimateSummary> = {};

  for (const scId of scenarioIds) {
    const transformedSeries = applyScenario(series, scId, deltas);
    results[scId] = calculateClimateSummary(transformedSeries);
  }

  // Backwards compatibility aliases
  results['hotter_drier'] = results['compound'];
  results['hotterAndDrier'] = results['compound'];

  return results as Record<CanonicalScenarioId, ClimateSummary> & { hotter_drier?: ClimateSummary; hotterAndDrier?: ClimateSummary };
}

/**
 * Pure function: Evaluate candidate sequence scores and robustness under climate shocks.
 */
export function evaluateScenarios(
  seq: CandidateSequence,
  baseClimate: ClimateData,
  soil: SoilData,
  priorities: FarmerPriorities,
  deltas?: ScenarioDeltas,
  waterSource?: WaterSource
): ScenarioEvaluation;
export function evaluateScenarios(
  seq: CandidateSequence,
  baseClimate: ClimateData,
  soil: SoilData,
  priorities: FarmerPriorities,
  waterSource?: WaterSource
): ScenarioEvaluation;
export function evaluateScenarios(
  seq: CandidateSequence,
  baseClimate: ClimateData,
  soil: SoilData,
  priorities: FarmerPriorities,
  deltasOrWaterSource?: ScenarioDeltas | WaterSource,
  maybeWaterSource?: WaterSource
): ScenarioEvaluation {
  let deltas: ScenarioDeltas | undefined;
  let waterSource: WaterSource = 'irrigation_canal';

  if (typeof deltasOrWaterSource === 'string') {
    waterSource = deltasOrWaterSource;
  } else if (deltasOrWaterSource && typeof deltasOrWaterSource === 'object') {
    deltas = deltasOrWaterSource;
    if (maybeWaterSource) {
      waterSource = maybeWaterSource;
    }
  } else if (maybeWaterSource) {
    waterSource = maybeWaterSource;
  }

  const scConfig = PILOT_CONFIG.scenarios;
  const penalties = scConfig.scoringPenalties;
  const hotterTempDeltaC = deltas?.hotterTempDeltaC ?? scConfig.hotterTempDeltaC;
  const drierPrecipMultiplier = deltas?.drierPrecipMultiplier ?? scConfig.drierPrecipMultiplier;
  const wetterPrecipMultiplier = deltas?.wetterPrecipMultiplier ?? scConfig.wetterPrecipMultiplier;

  // 1. Baseline
  const baseScores = calculateSequenceScores(seq, baseClimate, soil, priorities, waterSource);
  const baseline = baseScores.overall;

  // 2. Hotter (+1.5°C)
  const hotterClimate: ClimateData = {
    ...baseClimate,
    seasonalStats: {
      wet: { ...baseClimate.seasonalStats.wet, maxTemp: baseClimate.seasonalStats.wet.maxTemp + hotterTempDeltaC },
      dryCool: { ...baseClimate.seasonalStats.dryCool, maxTemp: baseClimate.seasonalStats.dryCool.maxTemp + hotterTempDeltaC },
      dryHot: { ...baseClimate.seasonalStats.dryHot, maxTemp: baseClimate.seasonalStats.dryHot.maxTemp + hotterTempDeltaC }
    },
    heatRisk: 'high',
    heatStressDaysPerYear: baseClimate.heatStressDaysPerYear + penalties.heatStressDaysPerYearDelta
  };
  const hotterScores = calculateSequenceScores(seq, hotterClimate, soil, priorities, waterSource);
  // Penalize crops with low heat tolerance
  let hotterDelta = 0;
  [seq.s1Crop, seq.s2Crop, seq.s3Crop].forEach((c) => {
    if (c.heatTolerance === 'low') hotterDelta += penalties.hotterCrops.low;
    else if (c.heatTolerance === 'medium') hotterDelta += penalties.hotterCrops.medium;
    else hotterDelta += penalties.hotterCrops.high;
  });
  const hotter = Math.min(100, Math.max(10, hotterScores.overall + hotterDelta));

  // 3. Drier (-15% Rainfall)
  const drierClimate: ClimateData = {
    ...baseClimate,
    meanAnnualPrecipitation: Math.round(baseClimate.meanAnnualPrecipitation * drierPrecipMultiplier),
    seasonalStats: {
      wet: { ...baseClimate.seasonalStats.wet, precip: Math.round(baseClimate.seasonalStats.wet.precip * drierPrecipMultiplier) },
      dryCool: { ...baseClimate.seasonalStats.dryCool, precip: Math.round(baseClimate.seasonalStats.dryCool.precip * drierPrecipMultiplier) },
      dryHot: { ...baseClimate.seasonalStats.dryHot, precip: Math.round(baseClimate.seasonalStats.dryHot.precip * drierPrecipMultiplier) }
    },
    drySpellRisk: 'high'
  };
  const drierScores = calculateSequenceScores(seq, drierClimate, soil, priorities, waterSource);
  let drierDelta = 0;
  [seq.s1Crop, seq.s2Crop, seq.s3Crop].forEach((c) => {
    if (c.droughtTolerance === 'high') drierDelta += penalties.drierCrops.droughtHigh;
    else if (c.droughtTolerance === 'low') drierDelta += penalties.drierCrops.droughtLow;

    if (c.waterDemand === 'high') drierDelta += penalties.drierCrops.highWaterDemand;
  });
  const drier = Math.min(100, Math.max(10, drierScores.overall + drierDelta));

  // 4. Hotter + Drier (Compound Shock)
  const hotterAndDrier = Math.min(
    100,
    Math.max(
      10,
      Math.round(
        baseline -
          Math.abs(baseline - hotter) * penalties.compound.hotterWeight -
          Math.abs(baseline - drier) * penalties.compound.drierWeight
      )
    )
  );

  // 5. Wetter (+15% Intense Rainfall & Flash Flood Risk)
  const wetterClimate: ClimateData = {
    ...baseClimate,
    meanAnnualPrecipitation: Math.round(baseClimate.meanAnnualPrecipitation * wetterPrecipMultiplier),
    seasonalStats: {
      wet: { ...baseClimate.seasonalStats.wet, precip: Math.round(baseClimate.seasonalStats.wet.precip * wetterPrecipMultiplier) },
      dryCool: { ...baseClimate.seasonalStats.dryCool, precip: Math.round(baseClimate.seasonalStats.dryCool.precip * wetterPrecipMultiplier) },
      dryHot: { ...baseClimate.seasonalStats.dryHot, precip: Math.round(baseClimate.seasonalStats.dryHot.precip * wetterPrecipMultiplier) }
    },
    excessWaterRisk: 'high'
  };
  const wetterScores = calculateSequenceScores(seq, wetterClimate, soil, priorities, waterSource);
  let wetterDelta = 0;
  // If S1 has low flood tolerance, heavy penalty
  if (seq.s1Crop.floodTolerance === 'low') wetterDelta += penalties.wetterCrops.floodLow;
  else if (seq.s1Crop.floodTolerance === 'high') wetterDelta += penalties.wetterCrops.floodHigh;

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
      compound: hotterAndDrier,
      hotterAndDrier,
      hotter_drier: hotterAndDrier,
      wetter
    },
    robustness,
    maxDegradation
  };
}
