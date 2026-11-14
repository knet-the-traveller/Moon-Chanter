import type { SoilData, SoilTexture, DrainageClass } from '../types';

export type ScoringSoil = SoilData & {
  texture: SoilTexture;
  drainage: DrainageClass;
  ph: number;
};

// These are inputs consumed by the existing scoring rules, not a confidence model.
export function hasRequiredSoilInputs(soil: SoilData | null): soil is ScoringSoil {
  return !!soil && soil.texture !== null && ['clay', 'clay_loam', 'loam', 'sandy_loam', 'sandy', 'silt_loam'].includes(soil.texture)
    && soil.drainage !== null && ['poor', 'moderate', 'well'].includes(soil.drainage)
    && soil.ph !== null && Number.isFinite(soil.ph) && soil.ph > 0 && soil.ph <= 14
    && ['low', 'medium', 'high'].includes(soil.organicMatter);
}

export function assertRequiredSoilInputs(soil: SoilData): asserts soil is ScoringSoil {
  if (!hasRequiredSoilInputs(soil)) throw new Error('Required soil inputs are unavailable');
}
