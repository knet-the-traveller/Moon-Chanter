import type {
  SoilTexture,
  DrainageClass,
  OrganicMatterLevel,
  MetricProvenance
} from '../types';

const SOIL_DOC = 'https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html';

export const VAN_BEMMELEN_FACTOR = 1.724;

/**
 * Derive organic-matter class from SoilGrids soil organic carbon (dg/kg) using
 * Van Bemmelen conversion (OM% ≈ SOC% × 1.724 -> Low < 1%, Medium 1–2.5%, High > 2.5%).
 * Preliminary classification requiring field/BSWM laboratory verification.
 */
export function deriveOrganicMatterFromSoc(socDgPerKg: number | undefined): OrganicMatterLevel {
  if (socDgPerKg === undefined || !Number.isFinite(socDgPerKg) || socDgPerKg < 0) {
    return 'unknown';
  }
  const omPercent = (socDgPerKg / 100) * VAN_BEMMELEN_FACTOR;
  if (omPercent < 1.0) return 'low';
  if (omPercent <= 2.5) return 'medium';
  return 'high';
}

/**
 * Derive preliminary soil drainage from topsoil texture fractions and SRTM slopePct.
 * Surface slope (> 8% / > 15%) promotes external runoff on heavy/medium textures.
 * Preliminary classification subject to local field inspection and farmer override.
 */
export function derivePreliminaryDrainage(params: {
  texture: SoilTexture | null;
  clayPct?: number;
  sandPct?: number;
  slopePct?: number | null;
}): DrainageClass | null {
  const { texture, clayPct, sandPct, slopePct } = params;
  if (texture === null) return null;

  let drainage: DrainageClass;
  if (texture === 'clay' || (clayPct !== undefined && Number.isFinite(clayPct) && clayPct >= 38)) {
    drainage = 'poor';
  } else if (
    texture === 'sandy' ||
    texture === 'sandy_loam' ||
    texture === 'loam' ||
    (sandPct !== undefined && Number.isFinite(sandPct) && sandPct >= 55)
  ) {
    drainage = 'well';
  } else {
    drainage = 'moderate';
  }

  if (slopePct !== undefined && slopePct !== null && Number.isFinite(slopePct) && slopePct >= 0) {
    if (drainage === 'poor' && slopePct > 8) {
      drainage = 'moderate';
    } else if (drainage === 'moderate' && slopePct > 15) {
      drainage = 'well';
    }
  }

  return drainage;
}

export function buildDerivedOrganicMatterProvenance(
  socDgPerKg: number | undefined,
  options?: {
    spatialResolution?: string | null;
    depth?: string | null;
    baseSource?: string;
    note?: string;
    sampleLocation?: MetricProvenance['sampleLocation'];
  }
): MetricProvenance {
  const om = deriveOrganicMatterFromSoc(socDgPerKg);
  if (om === 'unknown') {
    return {
      source: options?.baseSource ?? 'ISRIC SoilGrids 2.0',
      variable: 'soc → OM% (×1.724)',
      unit: 'class',
      spatialResolution: null,
      dateRange: null,
      depth: null,
      isSample: false,
      isSynthetic: false,
      tier: 'unavailable',
      needsReview: true,
      citation: SOIL_DOC,
      sampleLocation: options?.sampleLocation,
      note: 'Soil organic carbon unavailable; organic-matter class cannot be derived without field input.'
    };
  }

  return {
    source: 'FieldShift illustrative soil estimate',
    variable: 'soc → OM% (×1.724)',
    unit: 'class',
    spatialResolution: options?.spatialResolution ?? '250 m',
    dateRange: null,
    depth: options?.depth ?? '0–5 cm and 5–15 cm',
    isSample: false,
    isSynthetic: true,
    tier: 'synthetic',
    needsReview: true,
    citation: SOIL_DOC,
    sampleLocation: options?.sampleLocation,
    methodKey: 'provenance.methods.organicMatter',
    method: 'Derived via Van Bemmelen approximation (OM% ≈ SOC% × 1.724: Low <1%, Medium 1–2.5%, High >2.5%); verify locally.',
    note: options?.note ?? 'Derived from SoilGrids SOC via Van Bemmelen factor (1.724); verify with BSWM Soil Test Kit or laboratory analysis.'
  };
}

export function buildDerivedDrainageProvenance(params: {
  drainage: DrainageClass | null;
  hasSlope: boolean;
  spatialResolution?: string | null;
  depth?: string | null;
  baseSource?: string;
  note?: string;
  sampleLocation?: MetricProvenance['sampleLocation'];
}): MetricProvenance {
  const { drainage, hasSlope, spatialResolution, depth, baseSource, note, sampleLocation } = params;
  const variable = hasSlope ? 'texture + SRTM slopePct → drainage' : 'texture → drainage';
  if (drainage === null) {
    return {
      source: baseSource ?? 'ISRIC SoilGrids 2.0',
      variable,
      unit: 'class',
      spatialResolution: null,
      dateRange: null,
      depth: null,
      isSample: false,
      isSynthetic: false,
      tier: 'unavailable',
      needsReview: true,
      citation: SOIL_DOC,
      sampleLocation,
      note: 'Texture unavailable; preliminary drainage class cannot be derived without field input.'
    };
  }

  return {
    source: 'FieldShift illustrative soil estimate',
    variable,
    unit: 'class',
    spatialResolution: hasSlope ? '250 m SoilGrids + ~30 m SRTM' : (spatialResolution ?? '250 m'),
    dateRange: null,
    depth: depth ?? '0–5 cm and 5–15 cm',
    isSample: false,
    isSynthetic: true,
    tier: 'synthetic',
    needsReview: true,
    citation: SOIL_DOC,
    sampleLocation,
    methodKey: 'provenance.methods.drainage',
    method: hasSlope
      ? 'Preliminary drainage derived from SoilGrids texture fractions and SRTM Horn slopePct; confirm field waterlogging locally.'
      : 'Preliminary drainage derived from SoilGrids texture fractions; confirm field drainage locally.',
    note: note ?? 'Preliminary textural and topographic drainage estimate, not a field percolation test.'
  };
}
