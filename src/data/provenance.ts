import { z } from 'zod';
import { getTranslation } from '../i18n';
import type { ClimateData, SoilData, LandSummary, Language, MetricProvenance, ClimateMetric, SoilMetric } from '../types';
import type { LocalReviewDescriptor } from '../types';
import { hasRequiredSoilInputs } from '../engine/soilInputs';

export const MetricProvenanceSchema = z.object({
  source: z.string(), variable: z.string(), spatialResolution: z.string().nullable(), dateRange: z.string().nullable(),
  isSample: z.boolean(), isSynthetic: z.boolean(), needsReview: z.boolean(), note: z.string(),
  tier: z.enum(['live','cached-live','bundled-model','sample','synthetic','farmer','unavailable']).optional(),
  unit: z.string().optional(), depth: z.string().nullable().optional(), method: z.string().optional(), methodKey: z.string().optional(),
  cached: z.boolean().optional(), productVersion: z.string().nullable().optional(),
  citation: z.url().optional(), retrievedAt: z.iso.datetime({ offset: true }).nullable().optional(),
  sampleLocation: z.object({ name: z.string(), lat: z.number().min(-90).max(90).optional(), lon: z.number().min(-180).max(180).optional() }).optional()
});
export const ProvenanceRecordSchema = z.record(z.string(), MetricProvenanceSchema);
export const CLIMATE_METRICS: ClimateMetric[] = ['precipitation','temperature','maximumTemperature','minimumTemperature','solarRadiation','humidity','heatStressDays','rainfallTrend','risk'];
export const SOIL_METRICS: SoilMetric[] = ['texture','drainage','organicMatter','ph','rawClayPercent','rawSandPercent','rawSocDgPerKg','bulkDensityGcm3','phosphorusFixationRisk','slopePct'];
const POWER_DOC = 'https://power.larc.nasa.gov/docs/services/';
const SOIL_DOC = 'https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html';

export function unknownProvenance(source: string, variable: string, isSample = false): MetricProvenance {
  return { source, variable, spatialResolution: null, dateRange: null, isSample, isSynthetic: false,
    tier: isSample ? 'sample' : 'unavailable', needsReview: true,
    note: 'Legacy or unavailable metadata: verify source, location, observation period and method before field use.' };
}
export function climateProvenance(data: ClimateData): Record<ClimateMetric, MetricProvenance> {
  return Object.fromEntries(CLIMATE_METRICS.map(key => [key, data.provenance?.[key] ?? {
    ...unknownProvenance(data.source, key, data.isSampleData), dateRange: data.dateRange || null
  }])) as Record<ClimateMetric, MetricProvenance>;
}
export function soilProvenance(data: SoilData): Record<SoilMetric, MetricProvenance> {
  return Object.fromEntries(SOIL_METRICS.map(key => {
    const metadata = data.provenance?.[key];
    if (data[key] === null || data[key] === undefined || (key === 'organicMatter' && data.organicMatter === 'unknown')) {
      return [key, { ...unknownProvenance(metadata?.source ?? data.source, metadata?.variable ?? key),
        ...metadata, tier: 'unavailable',
        isSample: metadata?.isSample ?? data.isEstimate, cached: metadata?.cached,
        sampleLocation: metadata?.sampleLocation }];
    }
    return [key, metadata ?? unknownProvenance(data.source, key, data.isEstimate)];
  })) as Record<SoilMetric, MetricProvenance>;
}
export function cachedProvenance<T extends string>(metadata: Record<T, MetricProvenance>): Record<T, MetricProvenance> {
  return Object.fromEntries(Object.entries<MetricProvenance>(metadata).map(([key, value]) => [key, {
    ...value, cached: true, tier: value.tier === 'live' ? 'cached-live' : value.tier
  }])) as Record<T, MetricProvenance>;
}

export function buildClimateProvenance(data: ClimateData, tier: 'live' | 'cache' | 'sample' | 'bundled-model',
  sampleLocation?: MetricProvenance['sampleLocation']): Record<ClimateMetric, MetricProvenance> {
  const definitions: Record<ClimateMetric, [string, string, string | null, string]> = {
    precipitation: ['PRECTOTCORR','mm/month; mm/year','0.5° latitude × 0.625° longitude', 'Daily means × mean month lengths; monthly totals summed for seasons/year.'],
    temperature: ['T2M','°C','0.5° latitude × 0.625° longitude','Daily values averaged by month; monthly means averaged for annual temperature.'],
    maximumTemperature: ['T2M_MAX','°C','0.5° latitude × 0.625° longitude','Maximum daily Tmax within each calendar month over the source period; seasonal maximum of these values.'],
    minimumTemperature: ['T2M − 5 °C','°C',null,'Illustrative minimum-temperature approximation; T2M_MIN is not fetched.'],
    solarRadiation: ['ALLSKY_SFC_SW_DWN','MJ/m²/day','1° × 1° (CERES SYN1deg, 2014–2023)','Daily values averaged by calendar month.'],
    humidity: ['RH2M','%','0.5° latitude × 0.625° longitude','Daily values averaged by calendar month.'],
    heatStressDays: ['heatStressDaysPerYear','days/year',null,'Fixed legacy illustrative indicator, not calculated from fetched daily observations.'],
    rainfallTrend: ['trendDeltaPercent','%',null,'Fixed legacy illustrative indicator, not a fitted observed trend.'],
    risk: ['drySpellRisk / excessWaterRisk / heatRisk','class',null,'Fixed legacy illustrative classes, not calculated from fetched daily observations.']
  };
  return Object.fromEntries(CLIMATE_METRICS.map(key => {
    const [variable, unit, resolution, method] = definitions[key];
    const illustrative = ['minimumTemperature','heatStressDays','rainfallTrend','risk'].includes(key);
    return [key, { source: illustrative ? 'FieldShift illustrative climate indicator' : data.source, variable, unit,
      spatialResolution: illustrative || tier === 'sample' ? null : resolution,
      dateRange: illustrative ? null : data.dateRange, isSample: tier === 'sample', isSynthetic: illustrative,
      tier: illustrative ? 'synthetic' : tier === 'cache' ? 'cached-live' : tier,
      needsReview: true, cached: tier === 'cache', method, methodKey: `provenance.methods.${key}`, citation: POWER_DOC,
      sampleLocation, note: tier === 'sample' ? 'Bundled Muñoz reference; verify applicability to the selected field. Retrieval provenance is unavailable.'
        : 'Regional grid, not a field measurement. Aggregation, missing-data defaults and local applicability require review.' } satisfies MetricProvenance];
  })) as Record<ClimateMetric, MetricProvenance>;
}

export function buildSoilProvenance(data: SoilData, live: boolean, sampleLocation?: MetricProvenance['sampleLocation'],
  measuredBulkDensity = true): Record<SoilMetric, MetricProvenance> {
  const vars: Record<SoilMetric, string> = {
    texture:'clay / sand / silt → texture', drainage:'texture → drainage', organicMatter:'soc → organicMatter class',
    ph:'phh2o', rawClayPercent:'clay', rawSandPercent:'sand', rawSocDgPerKg:'soc',
    bulkDensityGcm3: measuredBulkDensity ? 'bdod' : 'texture → bulkDensityGcm3',
    phosphorusFixationRisk:'phh2o → phosphorusFixationRisk', slopePct:'regional slope benchmark'
  };
  const units: Partial<Record<SoilMetric,string>> = {ph:'pH',rawClayPercent:'%',rawSandPercent:'%',rawSocDgPerKg:'dg/kg',bulkDensityGcm3:'g/cm³',slopePct:'%'};
  const derived: SoilMetric[] = ['texture','drainage','organicMatter','phosphorusFixationRisk'];
  return Object.fromEntries(SOIL_METRICS.map(key => {
    if (data[key] === undefined || data[key] === null || (key === 'organicMatter' && data.organicMatter === 'unknown')) {
      return [key, { ...unknownProvenance(live ? 'ISRIC SoilGrids v2.0' : 'FieldShift municipal soil reference', vars[key]),
        isSample: !live, sampleLocation }];
    }
    const synthetic = key === 'slopePct' || (key === 'bulkDensityGcm3' && (!live || !measuredBulkDensity));
    return [key, { source: synthetic ? 'FieldShift illustrative soil estimate' : live ? 'ISRIC SoilGrids v2.0' : 'FieldShift municipal soil reference', variable: vars[key], unit: units[key] ?? 'class',
      spatialResolution: live && !synthetic ? '250 m' : null, dateRange: null,
      depth: live && !synthetic ? '0–5 cm and 5–15 cm; unweighted mean' : null,
      isSample: !live, isSynthetic: synthetic || (!live && /synthetic/i.test(data.reviewNote ?? '')),
      tier: synthetic ? 'synthetic' : live ? 'live' : 'sample', needsReview: true, sampleLocation,
      citation: SOIL_DOC, methodKey: synthetic ? 'provenance.methods.estimate' : `provenance.methods.${derived.includes(key) ? key : 'depthMean'}`,
      method: derived.includes(key) ? 'Local classification from source inputs; thresholds require local validation.'
        : synthetic ? 'Illustrative regional/texture estimate, not a parcel measurement.' : 'SoilGrids depth means are averaged without thickness weighting; observation dates unavailable.',
      note: data.reviewNote ?? 'Verify with local soil testing; grid predictions and local classifications do not establish field conditions.' } satisfies MetricProvenance];
  })) as Record<SoilMetric, MetricProvenance>;
}

export function formatProvenance(language: Language, metadata: MetricProvenance): string {
  const t = (key: string) => getTranslation(language, `provenance.${key}`);
  const status = metadata.isSynthetic ? t('synthetic') : t(metadata.tier ?? (metadata.isSample ? 'sample' : 'unavailable'));
  const source = metadata.tier === 'farmer' ? t('farmer') : metadata.source.startsWith('FieldShift illustrative') ? t('illustrativeSource')
    : metadata.source === 'FieldShift demonstration assumptions' ? getTranslation(language,'mvp.assumptionSource')
    : metadata.source === 'FieldShift municipal soil reference' ? t('municipalSoilSource') : metadata.source;
  return [source, metadata.productVersion ? `${t('version')} ${metadata.productVersion}` : null, metadata.variable, metadata.spatialResolution ?? t('unknownResolution'),
    metadata.dateRange ?? t('unknownDates'), metadata.unit, metadata.depth,
    metadata.methodKey ? getTranslation(language, metadata.methodKey) : null,
    metadata.sampleLocation ? `${t('reference')}: ${metadata.sampleLocation.name}` : null,
    status, metadata.cached && metadata.tier !== 'cached-live' ? t('cached') : null,
    metadata.needsReview ? t('review') : null].filter(Boolean).join(' | ');
}

export function formatLocalReview(language: Language, descriptor: LocalReviewDescriptor): string {
  return getTranslation(language, descriptor.translationKey).replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = descriptor.params?.[key];
    return value === undefined ? match : String(value);
  });
}

export interface PlanDataContext { climate: ClimateData | null; soil: SoilData | null; land: LandSummary | null }
export function hasProvisionalEvidence(context: PlanDataContext): boolean {
  if (!context.climate || !hasRequiredSoilInputs(context.soil) || !context.land) return true;
  return context.climate.isSampleData || context.soil.isEstimate || context.land.isSample
    || context.land.needsReview || !!context.soil.needsReview
    || contextProvenance(context).some(({ metadata }) => metadata.isSample || metadata.isSynthetic
      || metadata.needsReview || !metadata.tier || metadata.tier === 'unavailable'
      || !metadata.spatialResolution || !metadata.dateRange);
}
export function contextProvenance(context: PlanDataContext): Array<{ key: string; metadata: MetricProvenance }> {
  return [
    ...Object.entries(context.climate ? climateProvenance(context.climate) : { climate: unknownProvenance('NASA POWER', 'climate') })
      .map(([key, metadata]) => ({ key: `climate.${key}`, metadata })),
    ...Object.entries(context.soil ? soilProvenance(context.soil) : { soil: unknownProvenance('ISRIC SoilGrids', 'soil') })
      .map(([key, metadata]) => ({ key: `soil.${key}`, metadata })),
    ...Object.entries(context.land?.provenance ?? { land: unknownProvenance('Land reference', 'land', true) })
      .map(([key, metadata]) => ({ key: `land.${key}`, metadata: { ...metadata, sampleLocation: metadata.sampleLocation ?? (context.land ? {name:context.land.sampleHub.name} : undefined) } }))
  ];
}
