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
