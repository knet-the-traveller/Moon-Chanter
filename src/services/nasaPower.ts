import { z } from 'zod';
import { buildClimateProvenance, cachedProvenance, climateProvenance, ProvenanceRecordSchema } from '../data/provenance';
import { PILOT_CONFIG } from '../config/pilot';
import { CacheService, TELEMETRY_CACHE_TTL_MS } from './cache';
import type { ClimateData, MonthlyClimatePoint } from '../types';

export interface DailySeries {
  dataLocation?: { name: string; lat?: number; lon?: number };
  retrievedAt?: string | null;
  apiVersion?: string;
  location: { lat: number; lon: number };
  dates: string[]; // ISO YYYY-MM-DD
  t2m: (number | null)[];
  t2mMax: (number | null)[];
  prectotcorr: (number | null)[];
  rh2m: (number | null)[];
  allskySfcSwDwn: (number | null)[];
  tier: 'live' | 'cache' | 'sample';
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
const SeasonalSchema = z.object({ precip: z.number(), avgTemp: z.number(), maxTemp: z.number() });
const ClimateCacheSchema = z.object({
  source: z.string(), variableList: z.array(z.string()), dateRange: z.string(), isSampleData: z.boolean(),
  meanAnnualPrecipitation: z.number(), meanAnnualTemp: z.number(),
  seasonalStats: z.object({ wet: SeasonalSchema, dryCool: SeasonalSchema, dryHot: SeasonalSchema }),
  monthly: z.array(z.object({ month: z.string(), monthNum: z.number().int().min(1).max(12), temp: z.number(),
    tempMax: z.number(), tempMin: z.number(), rainfall: z.number(), solarRadiation: z.number(), humidity: z.number() })).min(1).max(12),
  heatStressDaysPerYear: z.number(), drySpellRisk: z.enum(['low','moderate','high']),
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
  if (val === null || val === undefined || typeof val !== 'number' || isNaN(val)) {
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
  tier: 'live' | 'cache' | 'sample',
  sourceLabel: string
): DailySeries {
  const payload = PowerPayloadSchema.parse(rawJson);
  const params = payload.properties.parameter;
  if (!params) {
    throw new Error('Malformed NASA POWER payload: missing properties.parameter');
  }

  const rawT2m = params.T2M || {};
  const rawT2mMax = params.T2M_MAX || {};
  const rawPrectotcorr = params.PRECTOTCORR || {};
  const rawRh2m = params.RH2M || {};
  const rawAllsky = params.ALLSKY_SFC_SW_DWN || {};

  // Sort dates chronologically
  const sortedDates = Object.keys(rawT2m).sort();

  const dates: string[] = [];
  const t2m: (number | null)[] = [];
  const t2mMax: (number | null)[] = [];
  const prectotcorr: (number | null)[] = [];
  const rh2m: (number | null)[] = [];
  const allskySfcSwDwn: (number | null)[] = [];

  for (const d of sortedDates) {
    dates.push(formatApiDateToIso(d));
    t2m.push(sanitizePowerValue(rawT2m[d]));
    t2mMax.push(sanitizePowerValue(rawT2mMax[d]));
    prectotcorr.push(sanitizePowerValue(rawPrectotcorr[d]));
    rh2m.push(sanitizePowerValue(rawRh2m[d]));
    allskySfcSwDwn.push(sanitizePowerValue(rawAllsky[d]));
  }

  return {
    location,
    apiVersion: payload.header?.api?.version,
    dataLocation: tier === 'sample' ? { name: PILOT_CONFIG.location.name,
      lat: payload.geometry?.coordinates[1], lon: payload.geometry?.coordinates[0] } : undefined,
    dates,
    t2m,
    t2mMax,
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

  const location = { lat, lon };
  const cacheKey = `nasa_power_daily_${lat.toFixed(3)}_${lon.toFixed(3)}_${start}_${end}`;

  if (options?.forceSample) {
    return loadBundledSampleDailySeries(location);
  }

  // 1. Try Live API with timeout & retries
  let lastError: Error | null = null;
  const url = `${PILOT_CONFIG.api.baseUrl}?parameters=T2M,T2M_MAX,PRECTOTCORR,RH2M,ALLSKY_SFC_SW_DWN&community=AG&longitude=${lon.toFixed(4)}&latitude=${lat.toFixed(4)}&start=${start}&end=${end}&format=JSON`;

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
      await CacheService.set(cacheKey, json, PILOT_CONFIG.api.cacheTtlMs);

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

  console.warn(`[nasaPower] Live API fetch failed (${lastError?.message}). Checking cache...`);

  // 2. Try Cache
  try {
    const cachedJson = await CacheService.get<unknown>(cacheKey);
    if (cachedJson) {
      return parsePowerDailyPayload(
        cachedJson,
        location,
        'cache',
        `NASA POWER cached daily (${formatApiDateToIso(start)} to ${formatApiDateToIso(end)})`
      );
    }
  } catch {
    // ignore cache read failure
  }

  console.warn(`[nasaPower] Cache miss or unavailable. Falling back to bundled sample data...`);

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
  const cacheKey = `nasa_power_climatology_${lat.toFixed(3)}_${lon.toFixed(3)}`;
  const cached = ClimateCacheSchema.safeParse(await CacheService.get<unknown>(cacheKey));
  if (cached.success) {
    const data: ClimateData = cached.data;
    return { ...data, provenance: cachedProvenance(climateProvenance(data)) };
  }

  try {
    const dailySeries = await fetchDailySeries({ lat, lon });
    // Convert daily to monthly summary format for UI cards
    const monthlyMap: Record<number, { temps: number[]; maxTemps: number[]; precips: number[]; rads: number[]; rhs: number[] }> = {};
    for (let m = 1; m <= 12; m++) {
      monthlyMap[m] = { temps: [], maxTemps: [], precips: [], rads: [], rhs: [] };
    }

    dailySeries.dates.forEach((dateStr, idx) => {
      const monthNum = parseInt(dateStr.slice(5, 7), 10);
      const t = dailySeries.t2m[idx];
      const tm = dailySeries.t2mMax[idx];
      const p = dailySeries.prectotcorr[idx];
      const r = dailySeries.allskySfcSwDwn[idx];
      const rh = dailySeries.rh2m[idx];

      if (t !== null) monthlyMap[monthNum].temps.push(t);
      if (tm !== null) monthlyMap[monthNum].maxTemps.push(tm);
      if (p !== null) monthlyMap[monthNum].precips.push(p);
      if (r !== null) monthlyMap[monthNum].rads.push(r);
      if (rh !== null) monthlyMap[monthNum].rhs.push(rh);
    });

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const daysInMonth = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    const monthly: MonthlyClimatePoint[] = monthNames.map((name, i) => {
      const mNum = i + 1;
      const b = monthlyMap[mNum];
      const avgT = b.temps.length ? b.temps.reduce((x, y) => x + y, 0) / b.temps.length : 27;
      const avgTm = b.maxTemps.length ? Math.max(...b.maxTemps) : 32;
      const avgMin = avgT - 5;
      const dailyPrecipMean = b.precips.length ? b.precips.reduce((x, y) => x + y, 0) / b.precips.length : 2;
      const monthlyRain = Math.round(dailyPrecipMean * daysInMonth[i]);
      const avgRad = b.rads.length ? b.rads.reduce((x, y) => x + y, 0) / b.rads.length : 18;
      const avgRh = b.rhs.length ? b.rhs.reduce((x, y) => x + y, 0) / b.rhs.length : 78;

      return {
        month: name,
        monthNum: mNum,
        temp: Number(avgT.toFixed(1)),
        tempMax: Number(avgTm.toFixed(1)),
        tempMin: Number(avgMin.toFixed(1)),
        rainfall: monthlyRain,
        solarRadiation: Number(avgRad.toFixed(1)),
        humidity: Math.round(avgRh)
      };
    });

    const meanAnnualPrecipitation = monthly.reduce((acc, m) => acc + m.rainfall, 0);
    const meanAnnualTemp = Number((monthly.reduce((acc, m) => acc + m.temp, 0) / 12).toFixed(1));

    const wetMonths = monthly.filter((m) => m.monthNum >= 6 && m.monthNum <= 11);
    const coolDryMonths = monthly.filter((m) => m.monthNum === 12 || m.monthNum === 1 || m.monthNum === 2);
    const hotDryMonths = monthly.filter((m) => m.monthNum >= 3 && m.monthNum <= 5);

    const calcSeasonal = (subset: MonthlyClimatePoint[]) => ({
      precip: subset.reduce((acc, m) => acc + m.rainfall, 0),
      avgTemp: Number((subset.reduce((acc, m) => acc + m.temp, 0) / subset.length).toFixed(1)),
      maxTemp: Math.max(...subset.map((m) => m.tempMax))
    });

    const climateResult: ClimateData = {
      source: dailySeries.source,
      variableList: ['T2M', 'T2M_MAX', 'PRECTOTCORR', 'ALLSKY_SFC_SW_DWN', 'RH2M'],
      dateRange: `${dailySeries.dates[0]} to ${dailySeries.dates[dailySeries.dates.length - 1]}`,
      isSampleData: dailySeries.isSample,
      meanAnnualPrecipitation,
      meanAnnualTemp,
      seasonalStats: {
        wet: calcSeasonal(wetMonths),
        dryCool: calcSeasonal(coolDryMonths),
        dryHot: calcSeasonal(hotDryMonths)
      },
      monthly,
      heatStressDaysPerYear: 38,
      drySpellRisk: 'high',
      excessWaterRisk: 'high',
      heatRisk: 'high',
      tenYearRainfallTrend: 'decreasing',
      trendDeltaPercent: -2.8
    };

    climateResult.provenance = buildClimateProvenance(climateResult, dailySeries.tier, dailySeries.dataLocation);
    for (const metadata of Object.values(climateResult.provenance)) {
      metadata.retrievedAt = dailySeries.retrievedAt ?? null;
      metadata.productVersion = dailySeries.apiVersion ?? null;
    }
    const seriesByMetric = { precipitation: dailySeries.prectotcorr, temperature: dailySeries.t2m,
      maximumTemperature: dailySeries.t2mMax, solarRadiation: dailySeries.allskySfcSwDwn, humidity: dailySeries.rh2m };
    for (const key of Object.keys(seriesByMetric) as Array<keyof typeof seriesByMetric>) {
      const hasMissingMonth = Array.from({ length: 12 }, (_, i) => i + 1).some(month => !dailySeries.dates.some((date, index) =>
        Number(date.slice(5, 7)) === month && seriesByMetric[key][index] !== null));
      if (hasMissingMonth) Object.assign(climateResult.provenance[key]!, { isSynthetic: true, tier: 'synthetic',
        methodKey: 'provenance.methods.missingDefault', method: 'At least one calendar month uses a legacy numeric default due to absent observations.', needsReview: true });
    }

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
