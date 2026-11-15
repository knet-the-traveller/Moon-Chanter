import type { Crop, SoilData } from '../types';
import { assertRequiredSoilInputs } from './soilInputs';
import { z } from 'zod';

/** [AGRO-RULE-06-SOIL-FIT] Team comparison weights, not measured yield effects.
 * Crop preferences are read unchanged from crops.json. See METHODOLOGY.md.
 */
export const SOIL_FIT_RULE = {
  phPointsPerUnit: 10,
  phMaximumPerCrop: 20,
  drainagePointsPerCrop: 12,
  needsReview: true,
  note: 'Uncalibrated comparison weights averaged over planted seasons; crop ranges and drainage classes require local agronomic review. No yield or confidence interpretation.'
} as const;

const phRangeSchema = z.object({
  minPh: z.number().finite().gt(0).max(14),
  maxPh: z.number().finite().gt(0).max(14)
}).refine(range => range.minPh <= range.maxPh);

function hasPhRange(crop: Crop): crop is Crop & { soilPref: Crop['soilPref'] & { minPh: number; maxPh: number } } {
  return phRangeSchema.safeParse(crop.soilPref).success;
}

export function assessSoilSuitability(crops: readonly Crop[], soil: SoilData) {
  assertRequiredSoilInputs(soil);
  const planted = crops.filter(crop => crop.family !== 'fallow');
  const phConflicts = planted.filter(hasPhRange).filter(crop => soil.ph < crop.soilPref.minPh || soil.ph > crop.soilPref.maxPh);
  const phUnassessed = planted.filter(crop => !hasPhRange(crop));
  const drainageConflicts = planted.filter(crop => !crop.soilPref.drainage.includes(soil.drainage));
  const phPenalty = planted.length ? Math.round(planted.reduce((sum, crop) => {
    if (!hasPhRange(crop)) return sum; // Unknown preference is not inferred or declared suitable.
    const distance = Math.max(crop.soilPref.minPh - soil.ph, soil.ph - crop.soilPref.maxPh, 0);
    return sum + Math.min(SOIL_FIT_RULE.phMaximumPerCrop, distance * SOIL_FIT_RULE.phPointsPerUnit);
  }, 0) / planted.length) : 0;
  const drainagePenalty = planted.length ? Math.round(drainageConflicts.length * SOIL_FIT_RULE.drainagePointsPerCrop / planted.length) : 0;
  return { phConflicts, phUnassessed, drainageConflicts, phPenalty, drainagePenalty };
}
