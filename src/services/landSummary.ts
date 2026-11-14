import { z } from 'zod';
import type { LandSummary, MetricProvenance } from '../types';
import {
  CoordinatesSchema, MunicipalLandFixtureSchema, NdviMonthlySchema,
  NdviObservationSchema, RusleFactorsSchema
} from '../types/landFixture';
import type { MunicipalLandFixture } from '../types/landFixture';

const FIXTURE_SLUGS = ['munoz', 'ilagan', 'pototan', 'malaybalay'] as const;
const FIXTURE_TIMEOUT_MS = 5000;
const fixtureLoads = new Map<string, Promise<MunicipalLandFixture>>();

function distanceKm(lat: number, lon: number, hub: MunicipalLandFixture['location']): number {
  const radians = Math.PI / 180;
  const latitudeDelta = (hub.lat - lat) * radians;
  const longitudeDelta = (hub.lon - lon) * radians;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(lat * radians) * Math.cos(hub.lat * radians) * Math.sin(longitudeDelta / 2) ** 2;
  // Spherical mean Earth radius, in kilometers, for municipal-proxy distances.
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

export function buildSampleLandSummary(
  lat: number, lon: number, fixtures: readonly MunicipalLandFixture[]
): LandSummary {
  CoordinatesSchema.parse({ lat, lon });
  const candidates = fixtures.flatMap((fixture) => {
    const parsed = MunicipalLandFixtureSchema.safeParse(fixture);
    if (!parsed.success) return [];
    try {
      const erosion = estimateErosion(parsed.data.land.rusle, parsed.data.land.ndviMonthly);
      return [{ fixture: parsed.data, distance: distanceKm(lat, lon, parsed.data.location), erosion }];
    } catch {
      return [];
    }
  });
  candidates.sort((a, b) => a.distance - b.distance || a.fixture.location.id.localeCompare(b.fixture.location.id, 'en'));
  const nearest = candidates[0];
  if (!nearest) throw new Error('No valid municipal land fixtures are available');

  const { location, land } = nearest.fixture;
  const ndvi = summarizeNdvi(land.ndviMonthly, land.annualNdvi,
    `sample${land.meta.isSynthetic ? ' synthetic' : ''} | ${land.meta.source}`);
  const provenance = (variable: string, note = land.meta.note, needsReview = land.meta.needsReview): MetricProvenance => ({
    source: land.meta.source, variable,
    spatialResolution: land.meta.spatialResolution, dateRange: land.meta.dateRange,
    isSample: true, isSynthetic: land.meta.isSynthetic, needsReview, note
  });

  return {
    elevationM: location.elevationMeters,
    slopePct: land.slopePct,
    floodProne: isFloodProne(location.elevationMeters, land.slopePct),
    bareFieldMonths: detectBareFieldMonths(land.ndviMonthly),
    rusleErosionRiskTonsHaYr: nearest.erosion,
    ndvi, landCover: land.landCover, isSample: true, needsReview: true,
    reviewNotes: [land.meta.note, FLOOD_THRESHOLDS.note, BARE_FIELD_REVIEW.note, COVER_FACTOR_ASSUMPTION.note],
    sampleHub: { id: location.id, name: location.name, lat: location.lat, lon: location.lon, distanceKm: Number(nearest.distance.toFixed(1)) },
    provenance: {
      elevationM: provenance('elevation (m)'),
      slopePct: provenance('slope (%)'),
      floodProne: provenance('[LAND-RULE-FLOOD]', `${land.meta.note} ${FLOOD_THRESHOLDS.note}`, true),
      bareFieldMonths: provenance('[LAND-RULE-BARE]', `${land.meta.note} ${BARE_FIELD_REVIEW.note}`, true),
      rusleErosionRiskTonsHaYr: provenance('[LAND-RULE-RUSLE] (t/ha/year)', `${land.meta.note} ${COVER_FACTOR_ASSUMPTION.note}`, true),
      'ndvi.seasonalMean': provenance('monthly NDVI'),
      'ndvi.trend': provenance('annual NDVI trend', ndvi.trendUnavailableReason ?? land.meta.note, !ndvi.trendAvailable || land.meta.needsReview)
    }
  };
}

async function readFixture(slug: string): Promise<MunicipalLandFixture> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const request = (async () => {
      const response = await fetch(`${import.meta.env.BASE_URL}sample-data/${slug}.json`, { signal: controller.signal });
      if (!response.ok) throw new Error(`Municipal fixture HTTP ${response.status}`);
      const json: unknown = await response.json();
      const fixture = MunicipalLandFixtureSchema.parse(json);
      estimateErosion(fixture.land.rusle, fixture.land.ndviMonthly);
      return fixture;
    })();
    const expired = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new Error('Municipal fixture loading timed out'));
      }, FIXTURE_TIMEOUT_MS);
    });
    return await Promise.race([request, expired]);
  } finally {
    clearTimeout(timeout);
  }
}

function loadFixture(slug: string): Promise<MunicipalLandFixture> {
  const existing = fixtureLoads.get(slug);
  if (existing) return existing;
  const request = readFixture(slug).catch((error: unknown) => {
    fixtureLoads.delete(slug);
    throw error;
  });
  fixtureLoads.set(slug, request);
  return request;
}

export async function fetchLandSummary(lat: number, lon: number, signal?: AbortSignal): Promise<LandSummary> {
  CoordinatesSchema.parse({ lat, lon });
  signal?.throwIfAborted();
  // Shared fixture loads have their own timeouts. A canceled caller cannot cancel another caller's fixtures.
  const loading = Promise.allSettled(FIXTURE_SLUGS.map(loadFixture));
  const results = await new Promise<PromiseSettledResult<MunicipalLandFixture>[]>((resolve, reject) => {
    const cancel = () => reject(new DOMException('Land summary request canceled', 'AbortError'));
    signal?.addEventListener('abort', cancel, { once: true });
    void loading.then(resolve, reject).finally(() => signal?.removeEventListener('abort', cancel));
    if (signal?.aborted) cancel();
  });
  signal?.throwIfAborted();
  const fixtures = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
  return buildSampleLandSummary(lat, lon, fixtures);
}

export const FALLOW_WINDOW_MONTHS = [3, 4, 5, 6] as const;
export const BARE_FIELD_NDVI_THRESHOLD = 0.25;
export const BARE_FIELD_REVIEW = {
  needsReview: true,
  note: 'Verify the 0.25 NDVI threshold and March–June fallow window against regional crop calendars and quality-controlled imagery.'
} as const;
export const COVER_FACTOR_ASSUMPTION = {
  exponent: 2,
  needsReview: true,
  note: 'Illustrative C = (1 - max(0, mean annual NDVI))². Calibrate cover factors with local management and erosion observations.'
} as const;

/** [LAND-RULE-BARE] Possible bare/fallow months within the proposed seasonal window. */
export function detectBareFieldMonths(monthly: unknown, window: readonly number[] = FALLOW_WINDOW_MONTHS): number[] {
  const profile = NdviMonthlySchema.parse(monthly);
  const months = z.array(z.number().int().min(1).max(12)).parse(window);
  return profile.flatMap((ndvi, index) =>
    ndvi < BARE_FIELD_NDVI_THRESHOLD && months.includes(index + 1) ? [index + 1] : []);
}

export function coverFactorFromNdvi(meanAnnualNdvi: number): number {
  z.number().finite().min(-1).max(1).parse(meanAnnualNdvi);
  return (1 - Math.max(0, meanAnnualNdvi)) ** COVER_FACTOR_ASSUMPTION.exponent;
}

/** [LAND-RULE-RUSLE] Illustrative annual sheet/rill erosion in metric tonnes/ha/year. */
export function estimateErosion(factors: unknown, monthly: unknown): number {
  const { R, K, LS, P } = RusleFactorsSchema.parse(factors);
  const profile = NdviMonthlySchema.parse(monthly);
  const mean = profile.reduce((sum, value) => sum + value, 0) / profile.length;
  const values = [R, K, LS, coverFactorFromNdvi(mean), P];
  if (values.includes(0)) return 0;
  const estimate = values.reduce((product, factor) => product * factor, 1);
  if (!Number.isFinite(estimate)) throw new RangeError('RUSLE estimate exceeds the finite numeric range');
  return Number(estimate.toFixed(1));
}

export const FLOOD_THRESHOLDS = {
  elevationM: 30,
  slopePct: 3,
  needsReview: true,
  note: 'Confirm lowland terrain thresholds with local flood/drainage observations and technicians.'
} as const;

/** [LAND-RULE-FLOOD] Preliminary lowland terrain screening. */
export function isFloodProne(elevationM: number, slopePct: number): boolean {
  z.number().finite().parse(elevationM);
  z.number().finite().nonnegative().parse(slopePct);
  return elevationM < FLOOD_THRESHOLDS.elevationM && slopePct <= FLOOD_THRESHOLDS.slopePct;
}

export function summarizeNdvi(monthly: unknown, annual: unknown, source: string): LandSummary['ndvi'] {
  const seasonalMean = NdviMonthlySchema.parse(monthly);
  const observations = z.array(NdviObservationSchema).parse(annual);
  const years = observations.map(({ date }) => new Date(date).getUTCFullYear());
  const unavailable = observations.length < 2 || new Set(years).size !== observations.length;
  if (unavailable) {
    return {
      seasonalMean, trend: 0, source, trendAvailable: false,
      trendUnavailableReason: 'Comparable annual observations from at least two distinct years are required.'
    };
  }

  const meanYear = years.reduce((sum, year) => sum + year, 0) / years.length;
  const meanNdvi = observations.reduce((sum, observation) => sum + observation.value, 0) / years.length;
  const numerator = observations.reduce((sum, observation, index) =>
    sum + (years[index] - meanYear) * (observation.value - meanNdvi), 0);
  const denominator = years.reduce((sum, year) => sum + (year - meanYear) ** 2, 0);
  // Ordinary least-squares slope of comparable annual means, in NDVI change/year.
  return {
    seasonalMean, trend: numerator / denominator, source,
    trendAvailable: true, trendUnavailableReason: null
  };
}
