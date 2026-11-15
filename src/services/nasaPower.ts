import { z } from 'zod';
import { buildClimateProvenance, cachedProvenance, climateProvenance, ProvenanceRecordSchema } from '../data/provenance';
import { CoordinatesSchema } from '../types/landFixture';
import { PILOT_CONFIG } from '../config/pilot';
import { CacheService, TELEMETRY_CACHE_TTL_MS } from './cache';
import { buildObservedClimate } from './observedClimate';
import type { ClimateData } from '../types';

export interface DailySeries {
  dataLocation?: { name: string; lat?: number; lon?: number };
  retrievedAt?: string | null;
  apiVersion?: string;
  location: { lat: number; lon: number };
  dates: string[]; // ISO YYYY-MM-DD
  t2m: (number | null)[];
  t2mMax: (number | null)[];
  t2mMin?: (number | null)[];
  prectotcorr: (number | null)[];
  rh2m: (number | null)[];
  allskySfcSwDwn: (number | null)[];
  tier: 'live' | 'cache' | 'sample' | 'bundled-model';
  isSample: boolean;
  source: string;
}

export interface FetchDailySeriesOptions {
  lat?: number;
  lon?: number;
  startApiFormat?: string; // YYYYMMDD
  endApiFormat?: string;   // YYYYMMDD
  timeoutMs?: number;
  maxRetries?: number;
  forceSample?: boolean;
}

const PowerPayloadSchema = z.object({
  properties: z.object({ parameter: z.object({ T2M: z.record(z.string().regex(/^\d{8}$/), z.unknown()).refine(values => Object.keys(values).length > 0) }).catchall(z.record(z.string().regex(/^\d{8}$/), z.unknown())) }),
  geometry: z.object({ coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]).rest(z.number()) }).optional(),
  header: z.object({ api: z.object({ version: z.string().optional() }).optional() }).optional()
});
export const climateCacheKey = (lat: number, lon: number) => `nasa_power_observed_v3_${lat}_${lon}`;
const RawCacheSchema = z.object({ payload: z.unknown(), retrievedAt: z.iso.datetime({offset:true}) });
const SeasonalSchema = z.object({ precip: z.number().nonnegative(), avgTemp: z.number(), maxTemp: z.number() });
const ClimateCacheSchema = z.object({
  source: z.string(), variableList: z.array(z.string()), dateRange: z.string(), isSampleData: z.boolean(),
  meanAnnualPrecipitation: z.number().nonnegative(), meanAnnualTemp: z.number(),
  seasonalStats: z.object({ wet: SeasonalSchema, dryCool: SeasonalSchema, dryHot: SeasonalSchema }),
  monthly: z.array(z.object({ month: z.string(), monthNum: z.number().int().min(1).max(12), temp: z.number(),
    tempMax: z.number(), tempMin: z.number().nullable(), rainfall: z.number().nonnegative(), solarRadiation: z.number().nonnegative(), humidity: z.number().min(0).max(100) })).length(12).refine(rows => new Set(rows.map(m=>m.monthNum)).size===12),
  heatStressDaysPerYear: z.number().min(0).max(366), drySpellRisk: z.enum(['low','moderate','high']),
  excessWaterRisk: z.enum(['low','moderate','high']), heatRisk: z.enum(['low','moderate','high']),
  tenYearRainfallTrend: z.enum(['increasing','stable','decreasing']), trendDeltaPercent: z.number(),
  provenance: ProvenanceRecordSchema.optional()
});

/**
 * Format raw date string "YYYYMMDD" to ISO "YYYY-MM-DD".
 */
export function formatApiDateToIso(dateStr: string): string {
  if (dateStr.length === 8) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  return dateStr;
}

/**
 * Sanitize NASA POWER numeric values. Treats missing-value fill code (-999, -999.00) as null.
 */
export function sanitizePowerValue(val: unknown): number | null {
  if (val === null || val === undefined || typeof val !== 'number' || !Number.isFinite(val)) {
    return null;
  }
  if (val <= -900) {
    return null;
  }
  return val;
}

/**
 * Parse raw NASA POWER JSON into a typed DailySeries.
 */
export function parsePowerDailyPayload(
  rawJson: unknown,
  location: { lat: number; lon: number },
  tier: 'live' | 'cache' | 'sample' | 'bundled-model',
  sourceLabel: string
): DailySeries {
  const payload = PowerPayloadSchema.parse(rawJson);
  CoordinatesSchema.parse(location);
  // POWER echoes the requested point (rounded to four decimal places by the
  // caller). A reference fallback deliberately has a different data location.
  const coordinates = payload.geometry?.coordinates;
  if (tier !== 'sample' && coordinates && (Math.abs(coordinates[0] - location.lon) > 0.0001
    || Math.abs(coordinates[1] - location.lat) > 0.0001)) {
    throw new Error('POWER response coordinates differ from the requested point');
  }
  const params = payload.properties.parameter;
  if (!params) {
    throw new Error('Malformed NASA POWER payload: missing properties.parameter');
  }

  const rawT2m = params.T2M || {};
  const rawT2mMax = params.T2M_MAX || {};
  const rawT2mMin = params.T2M_MIN || {};
  const rawPrectotcorr = params.PRECTOTCORR || {};
  const rawRh2m = params.RH2M || {};
  const rawAllsky = params.ALLSKY_SFC_SW_DWN || {};

  // Sort dates chronologically
  const keys = [...new Set(Object.values(params).flatMap(values => Object.keys(values)))].sort();
  for (const key of keys) {
    const iso = formatApiDateToIso(key);
    const date = new Date(`${iso}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso) throw new Error('Invalid POWER calendar date');
  }
  const sortedDates: string[] = [];
  const first = Date.parse(`${formatApiDateToIso(keys[0])}T00:00:00Z`);
  const last = Date.parse(`${formatApiDateToIso(keys[keys.length - 1])}T00:00:00Z`);
  if (last - first > 120 * 366 * 86400000) throw new Error('POWER date range too large');
  for (let day = first; day <= last; day += 86400000) sortedDates.push(new Date(day).toISOString().slice(0, 10).replaceAll('-', ''));

  const dates: string[] = [];
  const t2m: (number | null)[] = [];
  const t2mMax: (number | null)[] = [];
  const t2mMin: (number | null)[] = [];
  const prectotcorr: (number | null)[] = [];
  const rh2m: (number | null)[] = [];
  const allskySfcSwDwn: (number | null)[] = [];

  for (const d of sortedDates) {
    dates.push(formatApiDateToIso(d));
    t2m.push(sanitizePowerValue(rawT2m[d]));
    t2mMax.push(sanitizePowerValue(rawT2mMax[d]));
    t2mMin.push(sanitizePowerValue(rawT2mMin[d]));
    const rain = sanitizePowerValue(rawPrectotcorr[d]);
    prectotcorr.push(rain !== null && rain >= 0 ? rain : null);
    const humidity = sanitizePowerValue(rawRh2m[d]);
    const radiation = sanitizePowerValue(rawAllsky[d]);
    rh2m.push(humidity !== null && humidity >= 0 && humidity <= 100 ? humidity : null);
    allskySfcSwDwn.push(radiation !== null && radiation >= 0 ? radiation : null);
  }

  return {
    location,
    apiVersion: payload.header?.api?.version,
    dataLocation: tier === 'sample' ? { name: PILOT_CONFIG.location.name,
      lat: payload.geometry?.coordinates[1], lon: payload.geometry?.coordinates[0] } : undefined,
    dates,
    t2m,
    t2mMax,
    t2mMin,
    prectotcorr,
    rh2m,
    allskySfcSwDwn,
    tier,
    isSample: tier === 'sample',
    source: sourceLabel
  };
}

/**
 * Fetch daily series from NASA POWER API with retries, caching, and bundled fallback.
 */
export async function fetchDailySeries(options?: FetchDailySeriesOptions): Promise<DailySeries> {
  const lat = options?.lat ?? PILOT_CONFIG.location.lat;
  const lon = options?.lon ?? PILOT_CONFIG.location.lon;
  const start = options?.startApiFormat ?? PILOT_CONFIG.period.startApiFormat;
  const end = options?.endApiFormat ?? PILOT_CONFIG.period.endApiFormat;
  const timeoutMs = options?.timeoutMs ?? PILOT_CONFIG.api.timeoutMs;
  const maxRetries = options?.maxRetries ?? PILOT_CONFIG.api.maxRetries;

  const location = CoordinatesSchema.parse({ lat, lon });
  for (const date of [start, end]) {
    if (!/^\d{8}$/.test(date) || new Date(`${formatApiDateToIso(date)}T00:00:00Z`).toISOString().slice(0,10) !== formatApiDateToIso(date)) throw new Error('Invalid POWER request date');
  }
  if (start > end) throw new Error('POWER start is after end');
  const cacheKey = `nasa_power_daily_v2_${lat}_${lon}_${start}_${end}`;

  if (options?.forceSample) {
    return loadBundledSampleDailySeries(location);
  }

  // Versioned, public offline observations for exact pilot points only.
  const { resolveBundledPower } = await import('./bundledPower');
  const bundled = resolveBundledPower(lat, lon, start, end);
  if (bundled) return bundled;

  // A valid seven-day raw cache avoids redundant requests and preserves the
  // original retrieval timestamp. Malformed envelopes are never consumed.
  try {
    const cached = RawCacheSchema.safeParse(await CacheService.get<unknown>(cacheKey));
    if (cached.success) {
      const series = parsePowerDailyPayload(cached.data.payload, location, 'cache', `NASA POWER cached daily (${formatApiDateToIso(start)} to ${formatApiDateToIso(end)})`);
      series.retrievedAt = cached.data.retrievedAt;
      return series;
    }
  } catch { /* Continue to bounded acquisition. */ }

  // 1. Try Live API with timeout & retries
  let lastError: Error | null = null;
  const url = `${PILOT_CONFIG.api.baseUrl}?parameters=T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,ALLSKY_SFC_SW_DWN&community=AG&longitude=${lon.toFixed(4)}&latitude=${lat.toFixed(4)}&start=${start}&end=${end}&format=JSON`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { signal: controller.signal });
      // No retry on 4xx client errors
      if (res.status >= 400 && res.status < 500) {
        lastError = new Error(`NASA POWER API client error HTTP ${res.status}`);
        break;
      }

      if (!res.ok) {
        throw new Error(`NASA POWER API HTTP ${res.status}`);
      }

      const json = await res.json();
      const series = parsePowerDailyPayload(
        json,
        location,
        'live',
        `NASA POWER daily (${formatApiDateToIso(start)} to ${formatApiDateToIso(end)})`
      );

      series.retrievedAt = new Date().toISOString();

      // Save raw response in cache
      await CacheService.set(cacheKey, {payload:json,retrievedAt:series.retrievedAt}, PILOT_CONFIG.api.cacheTtlMs);

      return series;
    } catch (err: unknown) {
      clearTimeout(timeout);
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < maxRetries) {
        const backoffMs = PILOT_CONFIG.api.backoffBaseMs * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  console.warn(`[nasaPower] Live API fetch failed (${lastError?.message}); using labeled bundled reference.`);

  // 3. Fallback to bundled sample data
  return loadBundledSampleDailySeries(location);
}

/**
 * Load bundled sample data from public directory or filesystem.
 */
export async function loadBundledSampleDailySeries(location: { lat: number; lon: number }): Promise<DailySeries> {
  let sampleJson: unknown = null;

  // In Node.js environment (tests, scripts)
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    try {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const samplePath = path.resolve(process.cwd(), 'public/sample-data/nasa-power-pilot.json');
      if (fs.existsSync(samplePath)) {
        const raw = fs.readFileSync(samplePath, 'utf-8');
        sampleJson = JSON.parse(raw);
      }
    } catch {
      // ignore
    }
  }

  // In Browser environment
  if (!sampleJson && typeof fetch !== 'undefined') {
    try {
      const res = await fetch('/sample-data/nasa-power-pilot.json');
      if (res.ok) {
        sampleJson = await res.json();
      }
    } catch {
      // ignore
    }
  }

  if (sampleJson) {
    return parsePowerDailyPayload(
      sampleJson,
      location,
      'sample',
      'NASA POWER bundled pilot sample (Science City of Muñoz, 2014-2023)'
    );
  }

  throw new Error('Bundled NASA POWER sample dataset not found');
}

/**
 * Legacy Climatology helper for backward compatibility with UI components.
 */
export async function fetchNasaPowerClimate(lat: number, lon: number): Promise<ClimateData> {
  CoordinatesSchema.parse({lat,lon});
  const cacheKey = climateCacheKey(lat,lon);
  const cached = ClimateCacheSchema.safeParse(await CacheService.get<unknown>(cacheKey));
  if (cached.success) {
    const data: ClimateData = cached.data;
    return { ...data, provenance: cachedProvenance(climateProvenance(data)) };
  }

  try {
    const dailySeries = await fetchDailySeries({ lat, lon });
    const climateResult = buildObservedClimate(dailySeries);
    if (!climateResult) throw new Error('Insufficient complete calendar years for an observed climate profile');

    await CacheService.set(cacheKey, climateResult, TELEMETRY_CACHE_TTL_MS);
    return climateResult;
  } catch (err) {
    console.warn('[nasaPower] fetchNasaPowerClimate fallback triggered:', err);
    const fallback = getFallbackClimateLegacy();
    fallback.provenance = buildClimateProvenance(fallback, 'sample', { name: PILOT_CONFIG.location.name,
      lat: PILOT_CONFIG.location.lat, lon: PILOT_CONFIG.location.lon });
    return fallback;
  }
}

function getFallbackClimateLegacy(): ClimateData {
  return {
    source: 'NASA POWER Sample Baseline (Science City of Muñoz, 2014-2023)',
    variableList: ['T2M', 'T2M_MAX', 'T2M_MIN', 'PRECTOTCORR', 'ALLSKY_SFC_SW_DWN', 'RH2M'],
    dateRange: '2014-01-01 to 2023-12-31 (10-Year Decadal Average)',
    isSampleData: true,
    meanAnnualPrecipitation: 1845,
    meanAnnualTemp: 27.6,
    seasonalStats: {
      wet: { precip: 1410, avgTemp: 27.8, maxTemp: 32.4 },
      dryCool: { precip: 95, avgTemp: 25.6, maxTemp: 30.8 },
      dryHot: { precip: 340, avgTemp: 29.4, maxTemp: 35.6 }
    },
    monthly: [
      { month: 'Jan', monthNum: 1, temp: 25.1, tempMax: 30.5, tempMin: 19.8, rainfall: 12, solarRadiation: 16.4, humidity: 74 },
      { month: 'Feb', monthNum: 2, temp: 26.0, tempMax: 31.8, tempMin: 20.2, rainfall: 15, solarRadiation: 18.9, humidity: 71 },
      { month: 'Mar', monthNum: 3, temp: 27.9, tempMax: 34.2, tempMin: 21.6, rainfall: 28, solarRadiation: 21.2, humidity: 68 },
      { month: 'Apr', monthNum: 4, temp: 29.8, tempMax: 36.1, tempMin: 23.5, rainfall: 65, solarRadiation: 22.8, humidity: 66 },
      { month: 'May', monthNum: 5, temp: 29.5, tempMax: 34.8, tempMin: 24.2, rainfall: 210, solarRadiation: 20.5, humidity: 75 },
      { month: 'Jun', monthNum: 6, temp: 28.6, tempMax: 33.1, tempMin: 24.1, rainfall: 285, solarRadiation: 17.6, humidity: 82 },
      { month: 'Jul', monthNum: 7, temp: 27.9, tempMax: 32.0, tempMin: 23.8, rainfall: 365, solarRadiation: 15.8, humidity: 85 },
      { month: 'Aug', monthNum: 8, temp: 27.5, tempMax: 31.4, tempMin: 23.6, rainfall: 395, solarRadiation: 15.2, humidity: 87 },
      { month: 'Sep', monthNum: 9, temp: 27.8, tempMax: 32.1, tempMin: 23.5, rainfall: 310, solarRadiation: 16.5, humidity: 86 },
      { month: 'Oct', monthNum: 10, temp: 27.9, tempMax: 32.4, tempMin: 23.3, rainfall: 195, solarRadiation: 17.2, humidity: 83 },
      { month: 'Nov', monthNum: 11, temp: 26.8, tempMax: 31.6, tempMin: 22.0, rainfall: 78, solarRadiation: 16.8, humidity: 79 },
      { month: 'Dec', monthNum: 12, temp: 25.5, tempMax: 30.6, tempMin: 20.4, rainfall: 24, solarRadiation: 15.9, humidity: 76 }
    ],
    heatStressDaysPerYear: 42,
    drySpellRisk: 'high',
    excessWaterRisk: 'high',
    heatRisk: 'high',
    tenYearRainfallTrend: 'decreasing',
    trendDeltaPercent: -4.8
  };
}


export function getNearestSampleSlug(lat: number, lon: number): 'munoz' | 'ilagan' | 'pototan' {
  const hubs = [
    { slug: 'munoz' as const, lat: 15.714, lon: 120.906 },
    { slug: 'ilagan' as const, lat: 16.975, lon: 121.810 },
    { slug: 'pototan' as const, lat: 10.952, lon: 122.632 }
  ];

  let nearest = hubs[0];
  let minDistance = Infinity;

  for (const hub of hubs) {
    const d = Math.hypot(hub.lat - lat, hub.lon - lon);
    if (d < minDistance) {
      minDistance = d;
      nearest = hub;
    }
  }

  return nearest.slug;
}
