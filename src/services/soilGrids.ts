import { buildSoilProvenance, cachedProvenance, soilProvenance, ProvenanceRecordSchema } from '../data/provenance';
import { z } from 'zod';
import type {
  SoilData,
  SoilTexture,
  DrainageClass,
  OrganicMatterLevel,
  PhosphorusFixationRisk
} from '../types';
import { LocalCacheService, TELEMETRY_CACHE_TTL_MS } from './cache';
import { getNearestSampleSlug } from './nasaPower';
import { SoilModelEvidenceSchema } from '../types/soilGridsPackage';
import { resolveBundledSoil } from './bundledSoilGrids';
import { CoordinatesSchema } from '../types/landFixture';
import { deriveOrganicMatterFromSoc, derivePreliminaryDrainage } from './soilDerivation';

export { deriveOrganicMatterFromSoc, derivePreliminaryDrainage };

const SoilTextureSchema = z.enum([
  'clay',
  'clay_loam',
  'loam',
  'sandy_loam',
  'sandy',
  'silt_loam'
]);
const DrainageClassSchema = z.enum(['poor', 'moderate', 'well']);
const OrganicMatterLevelSchema = z.enum(['low', 'medium', 'high', 'unknown']);
const PhosphorusFixationRiskSchema = z.enum(['low', 'moderate', 'high']);

const SoilDataSchema = z.object({
  modelEvidence: SoilModelEvidenceSchema.optional(),
  source: z.string(),
  provenance: ProvenanceRecordSchema.optional(),
  texture: SoilTextureSchema.nullable(),
  drainage: DrainageClassSchema.nullable(),
  organicMatter: OrganicMatterLevelSchema,
  ph: z.number().gt(0).max(14).nullable(),
  isEstimate: z.boolean(),
  rawClayPercent: z.number().min(0).max(100).optional(),
  rawSandPercent: z.number().min(0).max(100).optional(),
  rawSocDgPerKg: z.number().min(0).max(10000).optional(),
  bulkDensityGcm3: z.number().positive().optional(),
  phosphorusFixationRisk: PhosphorusFixationRiskSchema.optional(),
  slopePct: z.number().nonnegative().optional(),
  needsReview: z.boolean().optional(),
  reviewNote: z.string().optional()
});

const SoilGridsApiPayloadSchema = z.object({
  properties: z.object({ layers: z.array(z.unknown()) })
});
const LayerNameSchema = z.object({ name: z.string() });
const SoilLayerSchema = z.object({
  depths: z.array(z.object({
    label: z.string(),
    values: z.object({ mean: z.number().nullable().optional() }).optional()
  }))
});

const SoilOverrideSchema = SoilDataSchema.pick({
  texture: true, drainage: true, organicMatter: true, ph: true,
  rawClayPercent: true, rawSandPercent: true, rawSocDgPerKg: true,
  bulkDensityGcm3: true, phosphorusFixationRisk: true, slopePct: true
}).partial();

export function parseFarmerSoilOverride(input: unknown): Partial<SoilData> | null {
  const parsed = SoilOverrideSchema.safeParse(input);
  if (!parsed.success) return null;
  const fields = Object.entries(parsed.data).filter(([, value]) => value !== undefined);
  return fields.length ? Object.fromEntries(fields) : null;
}

const FallbackFixtureSchema = z.object({
  location: z.object({ name: z.string(), lat: z.number().min(-90).max(90).optional(), lon: z.number().min(-180).max(180).optional() }),
  soil: SoilDataSchema.extend({ texture: SoilTextureSchema, drainage: DrainageClassSchema, ph: z.number().gt(0).max(14) })
});

/**
 * Legacy pH-only risk screen, retained for compatibility.
 * This is not a phosphorus measurement; the classification needs local validation.
 */
export function derivePhosphorusFixationRisk(ph: number): PhosphorusFixationRisk {
  if (ph < 5.5) return 'high';
  if (ph < 6.0) return 'moderate';
  return 'low';
}

/**
 * Legacy illustrative estimate retained for existing callers.
 * API ingestion does not use it; these values do not establish field compaction.
 */
export function estimateBulkDensityFromTexture(texture: SoilTexture): number {
  if (texture === 'clay') return 1.44;
  if (texture === 'clay_loam') return 1.38;
  return 1.28;
}

/**
 * Merge a 1-tap farmer soil override onto base telemetry while recalculating derived flags.
 */
export function applyFarmerSoilOverride(
  baseSoil: SoilData,
  input: Partial<SoilData> | null
): SoilData {
  const override = parseFarmerSoilOverride(input);
  if (!override) {
    return baseSoil;
  }

  const mergedPh = override.ph !== undefined ? override.ph : baseSoil.ph;
  const phosphorusFixationRisk = override.phosphorusFixationRisk
    ?? (override.ph !== undefined
      ? (mergedPh === null ? undefined : derivePhosphorusFixationRisk(mergedPh))
      : baseSoil.phosphorusFixationRisk ?? (mergedPh === null ? undefined : derivePhosphorusFixationRisk(mergedPh)));

  const provenance = soilProvenance(baseSoil);
  for (const key of Object.keys(provenance) as Array<keyof typeof provenance>) {
    if (override[key] !== undefined || (key === 'phosphorusFixationRisk' && override.ph !== undefined)) {
      const derivedFromOverridePh = key === 'phosphorusFixationRisk' && override.phosphorusFixationRisk === undefined && override.ph !== undefined;
      provenance[key] = { ...provenance[key], source: 'Farmer-reported field input', tier: 'farmer',
        variable: derivedFromOverridePh ? 'pH → phosphorusFixationRisk' : key,
        cached: false, retrievedAt: null, productVersion: null, citation: undefined,
        isSample: false, isSynthetic: false, spatialResolution: null, dateRange: null, depth: null,
        sampleLocation: undefined, needsReview: true,
        methodKey: derivedFromOverridePh ? 'provenance.methods.phosphorusFixationRisk' : 'provenance.methods.override',
        method: derivedFromOverridePh ? 'Existing pH-based classification applied to farmer input.' : 'Farmer override; not a laboratory-verified observation.',
        note: 'Confirm field input and any derived classification with a local agricultural technician.' };
    }
  }
  const result = { ...baseSoil, ...override, ph: mergedPh, phosphorusFixationRisk, provenance };
  return { ...result, provenance: soilProvenance(result) };
}

// A new namespace ignores every legacy cached profile containing numeric substitutes.
function hasSourceReadings(profile: SoilData): boolean {
  return profile.ph !== null || [profile.rawClayPercent, profile.rawSandPercent,
    profile.rawSocDgPerKg, profile.bulkDensityGcm3].some(value => value !== undefined);
}
const SoilCacheSchema = z.object({ schemaVersion: z.literal(2), profile: SoilDataSchema })
  .refine(({ profile }) => !profile.modelEvidence && !Object.values(profile.provenance ?? {}).some(metadata => metadata.tier === 'bundled-model'),
    'Bundled profiles must be resolved by native coverage, never by a live-query cache key')
  .refine(({ profile }) => hasSourceReadings(profile), 'Cached profile has no usable source readings');
export const soilCacheKey = (lat: number, lon: number) => `soilgrids_v2_${lat.toFixed(4)}_${lon.toFixed(4)}`;

export async function fetchSoilGridsData(lat: number, lon: number): Promise<SoilData> {
  CoordinatesSchema.parse({ lat, lon });
  const bundled = resolveBundledSoil(lat, lon);
  if (bundled) return bundled;
  const cacheKey = soilCacheKey(lat, lon);
  const cached = SoilCacheSchema.safeParse(await LocalCacheService.get<unknown>(cacheKey));
  if (cached.success) {
    return { ...cached.data.profile, provenance: cachedProvenance(soilProvenance(cached.data.profile)) };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon.toFixed(4)}&lat=${lat.toFixed(4)}&property=clay&property=sand&property=silt&property=phh2o&property=soc&property=bdod&depth=0-5cm&depth=5-15cm&value=mean`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`ISRIC SoilGrids HTTP ${response.status}`);
    const rawJson: unknown = await response.json();
    const parsedPayload = SoilGridsApiPayloadSchema.parse(rawJson);
    const layers = parsedPayload.properties.layers;

    // Missing, nodata and out-of-domain values stay absent. Zero is valid for
    // fractions and SOC; pH and bulk density must be positive. Units: ISRIC FAQ.
    const getLayerMean = (name: string, max?: number, positive = false): number | undefined => {
      const matches = layers.filter(layer => {
        const identity = LayerNameSchema.safeParse(layer);
        return identity.success && identity.data.name === name;
      });
      if (matches.length !== 1) return undefined;
      const parsed = SoilLayerSchema.safeParse(matches[0]);
      if (!parsed.success) return undefined;
      const depths = parsed.data.depths;
      const selectedDepths = ['0-5cm', '5-15cm'].map(label => depths.filter(depth => depth.label === label));
      if (selectedDepths.some(matches => matches.length !== 1)) return undefined;
      const values = selectedDepths.map(([depth]) => depth.values?.mean);
      if (!values.every((value): value is number => value !== undefined && value !== null
        && Number.isFinite(value) && (positive ? value > 0 : value >= 0) && (max === undefined || value <= max))) return undefined;
      // Preserve the existing unweighted method; do not silently drop missing depths.
      const mean = values.reduce((sum, value) => sum + value / values.length, 0);
      return Number.isFinite(mean) ? mean : undefined;
    };
    const clayVal = getLayerMean('clay', 1000);
    const sandVal = getLayerMean('sand', 1000);
    const siltVal = getLayerMean('silt', 1000);
    const phVal = getLayerMean('phh2o', 140, true);
    const socVal = getLayerMean('soc', 10000);
    const bdodVal = getLayerMean('bdod', undefined, true);
    const clayPct = clayVal === undefined ? undefined : Number((clayVal / 10).toFixed(1));
    const sandPct = sandVal === undefined ? undefined : Number((sandVal / 10).toFixed(1));
    const siltPct = siltVal === undefined ? undefined : Number((siltVal / 10).toFixed(1));
    const convertedPh = phVal === undefined ? 0 : Number((phVal / 10).toFixed(1));
    const ph = convertedPh > 0 ? convertedPh : null;
    let texture: SoilTexture | null = null;
    if (clayPct !== undefined && sandPct !== undefined && siltPct !== undefined && clayPct + sandPct + siltPct > 0) {
      if (clayPct >= 38) texture = 'clay';
      else if (clayPct >= 26) texture = 'clay_loam';
      else if (sandPct >= 55) texture = 'sandy_loam';
      else if (siltPct >= 50) texture = 'silt_loam';
      else texture = 'loam';
    }
    const drainage = derivePreliminaryDrainage({ texture, clayPct, sandPct });
    const organicMatter = deriveOrganicMatterFromSoc(socVal);
    const convertedDensity = bdodVal === undefined ? 0 : Number((bdodVal / 100).toFixed(2));
    const bulkDensityGcm3 = convertedDensity > 0 ? convertedDensity : undefined;
    const soilResult: SoilData = {
      source: 'ISRIC SoilGrids v2.0 model prediction',
      texture, drainage, organicMatter, ph, isEstimate: false,
      rawClayPercent: clayPct, rawSandPercent: sandPct, rawSocDgPerKg: socVal,
      bulkDensityGcm3,
      phosphorusFixationRisk: ph === null ? undefined : derivePhosphorusFixationRisk(ph),
      needsReview: true,
      reviewNote: 'Model predictions and local classifications require field verification. Missing source properties remain unavailable; no numeric substitutes are used.'
    };
    if (!hasSourceReadings(soilResult)) throw new Error('SoilGrids response contains no usable requested properties');
    soilResult.provenance = buildSoilProvenance(soilResult, true);
    const retrievedAt = new Date().toISOString();
    for (const metadata of Object.values(soilResult.provenance)) metadata.retrievedAt = retrievedAt;
    const profile = SoilDataSchema.parse(soilResult);
    await LocalCacheService.set(cacheKey, { schemaVersion: 2, profile }, TELEMETRY_CACHE_TTL_MS);
    return profile;
  } catch (err) {
    console.warn('SoilGrids query unavailable. Using a labeled municipal example.', err);
    const fallback = await getFallbackSoil(lat, lon);
    const name = isBukidnonCoordinates(lat, lon) ? 'Malaybalay, Bukidnon'
      : getNearestSampleSlug(lat, lon) === 'ilagan' ? 'City of Ilagan'
      : getNearestSampleSlug(lat, lon) === 'pototan' ? 'Pototan' : 'Science City of Muñoz';
    fallback.provenance ??= buildSoilProvenance(fallback, false, { name }, false);
    return fallback;
  } finally {
    clearTimeout(timeoutId);
  }
}

function isBukidnonCoordinates(lat: number, lon: number): boolean {
  const dBukidnon = Math.hypot(8.156 - lat, 125.127 - lon);
  const dPototan = Math.hypot(10.952 - lat, 122.632 - lon);
  return dBukidnon < dPototan && dBukidnon < 2.5;
}

async function getFallbackSoil(lat: number, lon: number): Promise<SoilData> {
  // Check Malaybalay Bukidnon upland highland Ultisol benchmark first
  if (isBukidnonCoordinates(lat, lon)) {
    return {
      source: 'FieldShift municipal soil example (Malaybalay, Bukidnon)',
      texture: 'clay_loam',
      drainage: 'well',
      organicMatter: 'medium',
      ph: 4.7,
      isEstimate: true,
      rawClayPercent: 34.0,
      rawSandPercent: 32.0,
      rawSocDgPerKg: 150,
      bulkDensityGcm3: 1.28,
      phosphorusFixationRisk: 'high',
      slopePct: 18,
      needsReview: true,
      reviewNote:
        'Synthetic regional upland Ultisol benchmark (pH 4.7, slopePct 18%, bd 1.28 g/cm3); verify exact parcel pH, Bray-2 P, and slope with local MAO/BSWM field test.'
    };
  }

  const sampleName = getNearestSampleSlug(lat, lon);
  const pilotBenchmarkExtras: Record<
    'munoz' | 'ilagan' | 'pototan',
    { bulkDensityGcm3: number; slopePct: number; note: string }
  > = {
    munoz: {
      bulkDensityGcm3: 1.44,
      slopePct: 2,
      note: 'Supplemental regional plow-pan bulkDensityGcm3 (1.44 g/cm3) and slopePct (2%) added outside bundled fixture; verify with field core/penetrometer test.'
    },
    ilagan: {
      bulkDensityGcm3: 1.32,
      slopePct: 8,
      note: 'Supplemental alluvial benchmark bulkDensityGcm3 (1.32 g/cm3) and slopePct (8%) added outside bundled fixture (alluvial site pH 6.6; upland Ultisol zones require local pH/Bray-2 P test).'
    },
    pototan: {
      bulkDensityGcm3: 1.38,
      slopePct: 3,
      note: 'Supplemental regional benchmark bulkDensityGcm3 (1.38 g/cm3) and slopePct (3%) added outside bundled fixture; verify with local technician.'
    }
  };
  const extras = pilotBenchmarkExtras[sampleName];

  const fixtureController = new AbortController();
  const fixtureTimeout = setTimeout(() => fixtureController.abort(), 5000);
  try {
    const res = await fetch(`/sample-data/${sampleName}.json`, { signal: fixtureController.signal });
    if (res.ok) {
      const rawData: unknown = await res.json();
      const parsed = FallbackFixtureSchema.safeParse(rawData);
      if (parsed.success) {
        const baseSoil = parsed.data.soil;
        const usedExtras =
          baseSoil.bulkDensityGcm3 === undefined || baseSoil.slopePct === undefined;
        const result: SoilData = {
          ...baseSoil,
          isEstimate: true,
          source: `FieldShift municipal soil example (${parsed.data.location.name})`,
          bulkDensityGcm3: baseSoil.bulkDensityGcm3 ?? extras.bulkDensityGcm3,
          phosphorusFixationRisk:
            baseSoil.phosphorusFixationRisk ?? derivePhosphorusFixationRisk(baseSoil.ph),
          slopePct: baseSoil.slopePct ?? extras.slopePct,
          needsReview: baseSoil.needsReview ?? usedExtras,
          reviewNote: baseSoil.reviewNote ?? (usedExtras ? extras.note : undefined)
        };
        result.provenance = buildSoilProvenance(result, false, parsed.data.location, false);
        return result;
      }
    }
  } catch {
    // fallback to embedded regional benchmark
  } finally {
    clearTimeout(fixtureTimeout);
  }

  if (sampleName === 'ilagan') {
    return {
      source: 'FieldShift municipal soil example (City of Ilagan, Isabela)',
      texture: 'loam',
      drainage: 'well',
      organicMatter: 'medium',
      ph: 6.6,
      isEstimate: true,
      rawClayPercent: 24.1,
      rawSandPercent: 41.5,
      rawSocDgPerKg: 158,
      bulkDensityGcm3: extras.bulkDensityGcm3,
      phosphorusFixationRisk: derivePhosphorusFixationRisk(6.6),
      slopePct: extras.slopePct,
      needsReview: true,
      reviewNote: extras.note
    };
  }

  if (sampleName === 'pototan') {
    return {
      source: 'FieldShift municipal soil example (Pototan, Iloilo)',
      texture: 'clay_loam',
      drainage: 'moderate',
      organicMatter: 'medium',
      ph: 6.1,
      isEstimate: true,
      rawClayPercent: 34.0,
      rawSandPercent: 30.5,
      rawSocDgPerKg: 135,
      bulkDensityGcm3: extras.bulkDensityGcm3,
      phosphorusFixationRisk: derivePhosphorusFixationRisk(6.1),
      slopePct: extras.slopePct,
      needsReview: true,
      reviewNote: extras.note
    };
  }

  return {
    source: 'FieldShift municipal soil example (Science City of Muñoz)',
    texture: 'clay_loam',
    drainage: 'moderate',
    organicMatter: 'medium',
    ph: 6.3,
    isEstimate: true,
    rawClayPercent: 36.5,
    rawSandPercent: 28.2,
    rawSocDgPerKg: 142,
    bulkDensityGcm3: extras.bulkDensityGcm3,
    phosphorusFixationRisk: derivePhosphorusFixationRisk(6.3),
    slopePct: extras.slopePct,
    needsReview: true,
    reviewNote: extras.note
  };
}
