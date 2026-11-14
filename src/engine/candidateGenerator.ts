import type { Crop, SeasonWindow, SoilData } from '../types';

export interface CandidateGenerationParams {
  allCrops: Crop[];
  soil: SoilData;
  recentCropId?: string; // What was planted last season
  excludedCropIds?: string[];
  maxCandidates?: number;
}

export interface CandidateSequence {
  s1Crop: Crop; // Wet season (Jun - Oct)
  s2Crop: Crop; // Cool dry season (Nov - Feb)
  s3Crop: Crop; // Hot dry season / catch crop (Mar - May)
}

export function generateCandidateRotations(params: CandidateGenerationParams): CandidateSequence[] {
  const { allCrops, soil, recentCropId, excludedCropIds = [], maxCandidates = 30 } = params;

  // Filter crops that are not excluded by the farmer
  const allowedCrops = allCrops.filter((crop) => !excludedCropIds.includes(crop.id));

  // Filter by season window and soil suitability
  const isSoilTolerant = (crop: Crop, season: SeasonWindow): boolean => {
    // In wet season, lowland rice is adapted to clay/clay_loam with poor/moderate drainage
    if (season === 'wet' && crop.id === 'rice') return true;
    
    // Check texture
    const textureOk = crop.soilPref.texture.includes(soil.texture);
    // Check drainage
    const drainageOk = crop.soilPref.drainage.includes(soil.drainage);

    return textureOk || drainageOk;
  };

  const s1Pool = allowedCrops.filter(
    (c) => c.plantingWindows.includes('wet') && isSoilTolerant(c, 'wet')
  );

  const s2Pool = allowedCrops.filter(
    (c) => c.plantingWindows.includes('dry_cool') && isSoilTolerant(c, 'dry_cool')
  );

  const s3Pool = allowedCrops.filter(
    (c) => c.plantingWindows.includes('dry_hot') && isSoilTolerant(c, 'dry_hot')
  );

  const candidates: CandidateSequence[] = [];

  for (const s1 of s1Pool) {
    // Avoid repeating recent crop if from the same botanical family and not a staple
    if (recentCropId) {
      const recentCrop = allCrops.find((c) => c.id === recentCropId);
      if (recentCrop && recentCrop.family === s1.family && s1.family === 'solanaceae') {
        continue; // strictly ban back-to-back Solanaceae
      }
    }

    for (const s2 of s2Pool) {
      // Rule 1: No identical back-to-back crop
      if (s2.id === s1.id) continue;
      // Rule 2: Strict disease prevention: No back-to-back Solanaceae (bacterial wilt)
      if (s1.family === 'solanaceae' && s2.family === 'solanaceae') continue;

      for (const s3 of s3Pool) {
        // Rule 3: No identical consecutive crop
        if (s3.id === s2.id) continue;
        // Rule 4: No back-to-back Solanaceae
        if (s2.family === 'solanaceae' && s3.family === 'solanaceae') continue;
        // Rule 5: Triple monoculture of grass is banned
        if (s1.family === 'grass' && s2.family === 'grass' && s3.family === 'grass') continue;

        // Rule 6: At least one break crop or legume in the 3-season cycle is strongly desired
        const hasLegume = s1.nitrogenFixing || s2.nitrogenFixing || s3.nitrogenFixing;
        const distinctFamilies = new Set([s1.family, s2.family, s3.family]).size;

        if (distinctFamilies >= 2 || hasLegume) {
          candidates.push({ s1Crop: s1, s2Crop: s2, s3Crop: s3 });
        }

        if (candidates.length >= maxCandidates * 3) {
          break;
        }
      }
    }
  }

  // Deduplicate and return top candidates
  const uniqueKeys = new Set<string>();
  const uniqueCandidates: CandidateSequence[] = [];

  for (const seq of candidates) {
    const key = `${seq.s1Crop.id}_${seq.s2Crop.id}_${seq.s3Crop.id}`;
    if (!uniqueKeys.has(key)) {
      uniqueKeys.add(key);
      uniqueCandidates.push(seq);
    }
    if (uniqueCandidates.length >= maxCandidates) break;
  }

  return uniqueCandidates;
}
