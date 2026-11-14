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
  source: z.string(),
  texture: SoilTextureSchema,
  drainage: DrainageClassSchema,
  organicMatter: OrganicMatterLevelSchema,
  ph: z.number(),
  isEstimate: z.boolean(),
  rawClayPercent: z.number().optional(),
  rawSandPercent: z.number().optional(),
  rawSocDgPerKg: z.number().optional(),
  bulkDensityGcm3: z.number().optional(),
  phosphorusFixationRisk: PhosphorusFixationRiskSchema.optional(),
  slopePct: z.number().optional(),
  needsReview: z.boolean().optional(),
  reviewNote: z.string().optional()
});

const SoilGridsApiPayloadSchema = z.object({
  properties: z.object({
    layers: z.array(
      z.object({
        name: z.string(),
        depths: z
          .array(
            z.object({
              values: z
                .object({
                  mean: z.number().nullable().optional()
                })
                .optional()
            })
          )
          .optional()
      })
    )
  })
});

const FallbackFixtureSchema = z.object({
  location: z.object({ name: z.string() }),
  soil: SoilDataSchema
});

/**
 * Derive phosphorus fixation risk from soil pH.
 * Acid Ultisols (pH < 5.5) bind available P below the 16 ppm Bray No. 2 threshold.
 */
export function derivePhosphorusFixationRisk(ph: number): PhosphorusFixationRisk {
  if (ph < 5.5) return 'high';
  if (ph < 6.0) return 'moderate';
  return 'low';
}

/**
 * Estimate fallback bulk density (g/cm3) from texture when SoilGrids `bdod` is absent.
 * Values > 1.4 g/cm3 reflect lowland plow-pan compaction in heavy clay paddies.
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
  override: Partial<SoilData> | null
): SoilData {
  if (!override || Object.keys(override).length === 0) {
    return baseSoil;
  }

  const mergedPh = override.ph ?? baseSoil.ph;
  const phosphorusFixationRisk =
    override.phosphorusFixationRisk ??
    (override.ph !== undefined
      ? derivePhosphorusFixationRisk(mergedPh)
      : baseSoil.phosphorusFixationRisk ?? derivePhosphorusFixationRisk(mergedPh));

  return {
    ...baseSoil,
    ...override,
    ph: mergedPh,
    phosphorusFixationRisk
  };
}

export async function fetchSoilGridsData(lat: number, lon: number): Promise<SoilData> {
  const cacheKey = `soilgrids_${lat.toFixed(3)}_${lon.toFixed(3)}`;
  const cachedRaw = await LocalCacheService.get<unknown>(cacheKey);
  if (cachedRaw) {
    const parsedCache = SoilDataSchema.safeParse(cachedRaw);
    if (parsedCache.success && parsedCache.data.bulkDensityGcm3 !== undefined) {
      return parsedCache.data;
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon.toFixed(4)}&lat=${lat.toFixed(4)}&property=clay&property=sand&property=silt&property=phh2o&property=soc&property=bdod&depth=0-5cm&depth=5-15cm&value=mean`;

    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`ISRIC SoilGrids HTTP ${response.status}`);
    }

    const rawJson: unknown = await response.json();
    const parsedPayload = SoilGridsApiPayloadSchema.safeParse(rawJson);
    if (!parsedPayload.success) {
      throw new Error('Invalid SoilGrids payload');
    }

    const layers = parsedPayload.data.properties.layers;

    const getLayerMean = (name: string): number => {
      const layer = layers.find((l) => l.name === name);
      if (!layer || !layer.depths || layer.depths.length === 0) return 0;
      const values = layer.depths
        .map((d) => d.values?.mean)
        .filter((v): v is number => v !== undefined && v !== null);
      if (values.length === 0) return 0;
      return values.reduce((a, b) => a + b, 0) / values.length;
    };

    const clayVal = getLayerMean('clay'); // g/kg
    const sandVal = getLayerMean('sand'); // g/kg
    const siltVal = getLayerMean('silt'); // g/kg
    const phVal = getLayerMean('phh2o'); // pH * 10
    const socVal = getLayerMean('soc'); // dg/kg
    const bdodVal = getLayerMean('bdod'); // cg/cm3

    const clayPct = Number((clayVal / 10).toFixed(1));
    const sandPct = Number((sandVal / 10).toFixed(1));
    const siltPct = Number((siltVal / 10).toFixed(1));
    const ph = phVal > 0 ? Number((phVal / 10).toFixed(1)) : 6.2;

    // Classify texture
    let texture: SoilTexture = 'loam';
    let drainage: DrainageClass = 'moderate';

    if (clayPct >= 38) {
      texture = 'clay';
      drainage = 'poor';
    } else if (clayPct >= 26) {
      texture = 'clay_loam';
      drainage = 'moderate';
    } else if (sandPct >= 55) {
      texture = 'sandy_loam';
      drainage = 'well';
    } else if (siltPct >= 50) {
      texture = 'silt_loam';
      drainage = 'moderate';
    } else {
      texture = 'loam';
      drainage = 'well';
    }

    // Classify organic matter (SOC): 100 dg/kg = 1.0% SOC
    let organicMatter: OrganicMatterLevel = 'medium';
    if (socVal >= 180) {
      organicMatter = 'high';
    } else if (socVal < 100) {
      organicMatter = 'low';
    }

    const hasMeasuredBdod = bdodVal > 0;
    const bulkDensityGcm3 =
      hasMeasuredBdod ? Number((bdodVal / 100).toFixed(2)) : estimateBulkDensityFromTexture(texture);
    const phosphorusFixationRisk = derivePhosphorusFixationRisk(ph);

    const soilResult: SoilData = {
      source: 'ISRIC SoilGrids v2.0 (Live Global Telemetry at 250m Resolution)',
      texture,
      drainage,
      organicMatter,
      ph,
      isEstimate: false,
      rawClayPercent: clayPct,
      rawSandPercent: sandPct,
      rawSocDgPerKg: socVal,
      bulkDensityGcm3,
      phosphorusFixationRisk,
      needsReview: !hasMeasuredBdod,
      reviewNote: hasMeasuredBdod
        ? undefined
        : 'SoilGrids bdod layer missing at coordinate; bulkDensityGcm3 estimated from texture class (needs local penetrometer/core verification).'
    };

    await LocalCacheService.set(cacheKey, soilResult, TELEMETRY_CACHE_TTL_MS);
    return soilResult;
  } catch (err) {
    console.warn('SoilGrids live query failed. Falling back to local pilot profile.', err);
    return await getFallbackSoil(lat, lon);
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
      source: 'ISRIC SoilGrids & DA-BSWM Regional Benchmark (Malaybalay, Bukidnon Upland Ultisol)',
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

  try {
    const res = await fetch(`/sample-data/${sampleName}.json`);
    if (res.ok) {
      const rawData: unknown = await res.json();
      const parsed = FallbackFixtureSchema.safeParse(rawData);
      if (parsed.success) {
        const baseSoil = parsed.data.soil;
        const usedExtras =
          baseSoil.bulkDensityGcm3 === undefined || baseSoil.slopePct === undefined;
        return {
          ...baseSoil,
          isEstimate: true,
          source: `ISRIC SoilGrids Benchmark Profile (${parsed.data.location.name})`,
          bulkDensityGcm3: baseSoil.bulkDensityGcm3 ?? extras.bulkDensityGcm3,
          phosphorusFixationRisk:
            baseSoil.phosphorusFixationRisk ?? derivePhosphorusFixationRisk(baseSoil.ph),
          slopePct: baseSoil.slopePct ?? extras.slopePct,
          needsReview: baseSoil.needsReview ?? usedExtras,
          reviewNote: baseSoil.reviewNote ?? (usedExtras ? extras.note : undefined)
        };
      }
    }
  } catch {
    // fallback to embedded regional benchmark
  }

  if (sampleName === 'ilagan') {
    return {
      source: 'ISRIC SoilGrids Regional Benchmark (City of Ilagan, Isabela)',
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
      source: 'ISRIC SoilGrids Regional Benchmark (Pototan, Iloilo)',
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
    source: 'ISRIC SoilGrids Regional Benchmark (Muñoz Maligaya Clay Loam)',
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
