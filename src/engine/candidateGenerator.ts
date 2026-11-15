import type { Crop, SeasonWindow, SoilData } from '../types';
import { hasRequiredSoilInputs } from './soilInputs';

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
  isBaseline?: boolean;
  planName?: { en: string; local: string };
}

// [AGRO-RULE-05-MODEL-SUPPORT] Model pH alone cannot identify upland terrain.
function isUplandSoil(soil: SoilData): boolean {
  return (soil.slopePct !== undefined && soil.slopePct > 15) || (!soil.modelEvidence && soil.ph !== null && soil.ph < 5.5 && soil.drainage !== 'poor');
}

function buildBaselineCandidate(allCrops: Crop[], soil: SoilData): CandidateSequence | null {
  const rice = allCrops.find((c) => c.id === 'rice');
  const corn = allCrops.find((c) => c.id === 'corn');
  const fallow = allCrops.find((c) => c.id === 'fallow');
  if (!fallow) return null;

  if (isUplandSoil(soil) && corn) {
    return {
      s1Crop: corn,
      s2Crop: corn,
      s3Crop: fallow,
      isBaseline: true,
      planName: {
        en: 'Existing Baseline: Continuous Upland Corn → Bare Fallow',
        local: 'Kasalukuyang Nakagawian: Tuloy-tuloy na Mais → Bakanteng Lupa'
      }
    };
  }

  if (rice) {
    return {
      s1Crop: rice,
      s2Crop: rice,
      s3Crop: fallow,
      isBaseline: true,
      planName: {
        en: 'Existing Baseline: Continuous Double Rice → Bare Fallow',
        local: 'Kasalukuyang Nakagawian: Dalawahang Palay → Bakanteng Lupa'
      }
    };
  }

  return null;
}

function buildCanonicalAdaptiveCandidates(allowedCrops: Crop[], soil: SoilData): CandidateSequence[] {
  const byId = new Map(allowedCrops.map((c) => [c.id, c]));
  const pinned: CandidateSequence[] = [];
  const upland = isUplandSoil(soil);

  if (!upland) {
    // Strategy 2: Wet Rice -> Relay Pag-asa Mungbean -> Dry Yellow Corn
    const rice = byId.get('rice');
    const mungbean = byId.get('mungbean');
    const corn = byId.get('corn');
    if (rice && mungbean && corn) {
      pinned.push({
        s1Crop: rice,
        s2Crop: mungbean,
        s3Crop: corn,
        planName: {
          en: 'Adaptive Relay: Wet Rice → Pag-asa Mungbean → Dry Yellow Corn',
          local: 'Palay → Pag-asa Munggo → Dilaw na Mais (Tag-araw)'
        }
      });
    }

    // Strategy 3: Wet Rice -> Bulb Onion -> Pre-Rice Mungbean
    const onion = byId.get('onion');
    if (rice && onion && mungbean) {
      pinned.push({
        s1Crop: rice,
        s2Crop: onion,
        s3Crop: mungbean,
        planName: {
          en: 'Commercial Diversification: Wet Rice → Bulb Onion → Pre-Rice Mungbean',
          local: 'Palay → Sibuyas → Munggo Bago Mag-Palay'
        }
      });
    }
  } else {
    // Strategy 4: Upland Conservation (Sloping Corn–Mungbean -> Legume/Root Crop)
    const corn = byId.get('corn');
    const mungbean = byId.get('mungbean');
    const sweetPotato = byId.get('sweet_potato');
    if (corn && mungbean && sweetPotato) {
      pinned.push({
        s1Crop: corn,
        s2Crop: mungbean,
        s3Crop: sweetPotato,
        planName: {
          en: 'Upland Soil Armor: Corn → Mungbean → Sweet Potato (Kamote)',
          local: 'Mais → Munggo → Kamote (Pananggalang sa Pagguho ng Lupa)'
        }
      });
    }
  }

  return pinned;
}

export function generateCandidateRotations(params: CandidateGenerationParams): CandidateSequence[] {
  const { allCrops, soil, recentCropId, excludedCropIds = [], maxCandidates = 30 } = params;
  if (!hasRequiredSoilInputs(soil)) return [];

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

  // Exclude fallow from adaptive combinatoric pools (reserved for baseline benchmark)
  const adaptiveAllowed = allowedCrops.filter((crop) => crop.family !== 'fallow');

  const s1Pool = adaptiveAllowed.filter(
    (c) => c.plantingWindows.includes('wet') && isSoilTolerant(c, 'wet')
  );

  const s2Pool = adaptiveAllowed.filter(
    (c) => c.plantingWindows.includes('dry_cool') && isSoilTolerant(c, 'dry_cool')
  );

  const s3Pool = adaptiveAllowed.filter(
    (c) => c.plantingWindows.includes('dry_hot') && isSoilTolerant(c, 'dry_hot')
  );

  const baselineCandidate = buildBaselineCandidate(allCrops, soil);
  const canonicalAdaptive = buildCanonicalAdaptiveCandidates(adaptiveAllowed, soil);

  const candidates: CandidateSequence[] = [...canonicalAdaptive];

  for (const s1 of s1Pool) {
    // Avoid repeating recent crop if from a high-risk continuous host family
    if (recentCropId) {
      const recentCrop = allCrops.find((c) => c.id === recentCropId);
      if (
        recentCrop &&
        recentCrop.family === s1.family &&
        (s1.family === 'solanaceae' || s1.family === 'amaryllidaceae')
      ) {
        continue; // strictly ban back-to-back Solanaceae / Allium
      }
    }

    for (const s2 of s2Pool) {
      // Rule 1: No identical back-to-back crop
      if (s2.id === s1.id) continue;
      // Rule 2: Strict disease/pest break: No back-to-back Solanaceae (bacterial wilt) or Amaryllidaceae (purple blotch)
      if (s1.family === 'solanaceae' && s2.family === 'solanaceae') continue;
      if (s1.family === 'amaryllidaceae' && s2.family === 'amaryllidaceae') continue;

      for (const s3 of s3Pool) {
        // Rule 3: No identical consecutive crop
        if (s3.id === s2.id) continue;
        // Rule 4: No back-to-back Solanaceae or Amaryllidaceae
        if (s2.family === 'solanaceae' && s3.family === 'solanaceae') continue;
        if (s2.family === 'amaryllidaceae' && s3.family === 'amaryllidaceae') continue;
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

  // Deduplicate and return top candidates (reserve 1 slot for pinned Strategy 1 baseline)
  const uniqueKeys = new Set<string>();
  const uniqueCandidates: CandidateSequence[] = [];
  const adaptiveLimit = baselineCandidate ? Math.max(0, maxCandidates - 1) : maxCandidates;

  for (const seq of candidates) {
    const key = `${seq.s1Crop.id}_${seq.s2Crop.id}_${seq.s3Crop.id}`;
    if (!uniqueKeys.has(key)) {
      uniqueKeys.add(key);
      uniqueCandidates.push(seq);
    }
    if (uniqueCandidates.length >= adaptiveLimit) break;
  }

  if (baselineCandidate) {
    uniqueCandidates.push(baselineCandidate);
  }

  return uniqueCandidates;
}
