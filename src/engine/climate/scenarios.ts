import type { DailySeries } from '../../services/nasaPower';
import type { ClimateSummary } from '../../types/contracts';
import { PILOT_CONFIG } from '../../config/pilot';
import { calculateClimateSummary } from './climateSummary';

export type ClimateScenarioId = 'baseline' | 'hotter' | 'drier' | 'wetter' | 'hotter_drier';

export interface ScenarioDeltas {
  hotterTempDeltaC?: number;
  drierPrecipMultiplier?: number;
  wetterPrecipMultiplier?: number;
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
    case 'hotter_drier':
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
    prectotcorr: transformedPrecip,
    source: `${series.source} [Scenario: ${scenario}]`
  };
}

/**
 * Pure function: Summarize daily series across all scenarios.
 * Returns a Record<ClimateScenarioId, ClimateSummary>.
 */
export function summarizeAllScenarios(
  series: DailySeries,
  deltas?: ScenarioDeltas
): Record<ClimateScenarioId, ClimateSummary> {
  const scenarioIds: ClimateScenarioId[] = ['baseline', 'hotter', 'drier', 'wetter', 'hotter_drier'];
  const results: Partial<Record<ClimateScenarioId, ClimateSummary>> = {};

  for (const scId of scenarioIds) {
    const transformedSeries = applyScenario(series, scId, deltas);
    results[scId] = calculateClimateSummary(transformedSeries);
  }

  return results as Record<ClimateScenarioId, ClimateSummary>;
}
