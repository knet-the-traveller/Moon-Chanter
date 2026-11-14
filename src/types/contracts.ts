/**
 * Shared Data Contracts
 * Note: Share this file with team members implementing UI, Soil, and Rotation Engine modules.
 */

import type { SoilData } from './index';

export type { SoilProfile, PhosphorusFixationRisk } from './index';
export type SoilContract = SoilData;

export interface ClimateSummary {
  location: { lat: number; lon: number };
  period: { start: string; end: string };          // ISO dates (YYYY-MM-DD)
  seasons: Array<{
    name: "wet" | "dry";
    meanTempC: number;
    rainfallMm: number;                            // mean seasonal total across years
    rainfallVariability: number;                   // coefficient of variation of seasonal totals (stdDev / mean)
    dryspellDaysAvg: number;                       // mean of the longest dry spell per season (days)
    heatStressDays: number;                        // mean days per season above heat threshold
    soilMoistureIndex?: number;                    // left undefined for now (SMAP comes later)
  }>;
  trend10y: { tempC: number; rainfallPct: number }; // slope per decade
  risks: {
    drought: "low" | "med" | "high";
    flood: "low" | "med" | "high";
    heat: "low" | "med" | "high";
  };
  sources: string[];                               // e.g. ["NASA POWER daily 2014-2023"]
  isSample: boolean;                               // true when bundled fallback data is used
}

export type LandMetric =
  | 'elevationM'
  | 'slopePct'
  | 'floodProne'
  | 'bareFieldMonths'
  | 'rusleErosionRiskTonsHaYr'
  | 'ndvi.seasonalMean'
  | 'ndvi.trend';

export interface MetricProvenance {
  source: string;
  variable: string;
  spatialResolution: string | null;
  dateRange: string | null;
  isSample: boolean;
  isSynthetic: boolean;
  needsReview: boolean;
  note: string;
  tier?: 'live' | 'cached-live' | 'sample' | 'synthetic' | 'farmer' | 'unavailable';
  unit?: string;
  depth?: string | null;
  method?: string;
  methodKey?: string;
  cached?: boolean;
  productVersion?: string | null;
  citation?: string;
  retrievedAt?: string | null;
  sampleLocation?: { name: string; lat?: number; lon?: number };
}

export type ClimateMetric = 'precipitation' | 'temperature' | 'maximumTemperature' | 'minimumTemperature'
  | 'solarRadiation' | 'humidity' | 'heatStressDays' | 'rainfallTrend' | 'risk';
export type SoilMetric = 'texture' | 'drainage' | 'organicMatter' | 'ph' | 'rawClayPercent'
  | 'rawSandPercent' | 'rawSocDgPerKg' | 'bulkDensityGcm3' | 'phosphorusFixationRisk' | 'slopePct';

export interface LandSummary {
  elevationM: number; // Finite elevation in meters.
  slopePct: number; // Finite, nonnegative percent slope.
  floodProne: boolean;
  bareFieldMonths: number[]; // Sorted, unique integers 1–12.
  rusleErosionRiskTonsHaYr: number; // Finite, nonnegative metric tonnes/ha/year.
  ndvi: {
    seasonalMean: number[]; // Exactly 12 finite values in [-1, 1], January–December.
    trend: number; // NDVI change/year; zero when unavailable.
    source: string;
    trendAvailable: boolean;
    trendUnavailableReason: string | null;
  };
  landCover?: string;
  isSample: boolean;
  needsReview: boolean;
  reviewNotes: string[];
  sampleHub: {
    id: string;
    name: string;
    lat: number;
    lon: number;
    distanceKm: number;
  };
  provenance: Record<LandMetric, MetricProvenance>;
}
