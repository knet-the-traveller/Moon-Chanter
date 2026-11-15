import { TELEMETRY_CACHE_TTL_MS } from '../services/cache';

/**
 * Pilot Region Configuration & Tunable Climate Thresholds
 * 
 * Target Pilot: Science City of Muñoz, Nueva Ecija, Philippines
 * Coordinates: 15.714°N, 120.906°E
 */

export interface PilotConfig {
  location: {
    name: string;
    province: string;
    region: string;
    lat: number;
    lon: number;
    elevationMeters: number;
  };
  period: {
    startYear: number;
    endYear: number;
    startDate: string; // ISO format: YYYY-MM-DD
    endDate: string;   // ISO format: YYYY-MM-DD
    startApiFormat: string; // YYYYMMDD for NASA POWER
    endApiFormat: string;   // YYYYMMDD for NASA POWER
  };
  thresholds: {
    // Heat stress threshold for daily maximum temperature (T2M_MAX)
    heatStressTempThresholdC: number;
    heatStressTempThreshold34C: number;
    heatStressTempThreshold35C: number;
    // Rainfall below this threshold is counted as a dry day
    dryDayPrecipThresholdMm: number;
    // Maximum allowable fraction of missing/null days before a season-year is excluded
    maxMissingDayFraction: number;
    // Definition of seasons by month indices (1 = January ... 12 = December)
    seasons: {
      wet: {
        name: 'wet';
        months: number[]; // [6, 7, 8, 9, 10] (June - October)
      };
      dry: {
        name: 'dry';
        months: number[]; // [11, 12, 1, 2, 3, 4, 5] (November - May, crosses calendar year)
      };
      dryWindows: {
        coolDry: {
          name: 'coolDry';
          months: number[]; // [11, 12, 1] (November - January, residual moisture)
        };
        hotDry: {
          name: 'hotDry';
          months: number[]; // [2, 3, 4, 5] (February - May, terminal drought/heat)
        };
      };
    };
    // Risk classification thresholds (placeholders needing climate/agronomy review)
    riskCriteria: {
      // Drought risk: determined by seasonal dry rainfall total & average longest dry spell
      drought: {
        highDryspellDays: number; // e.g. longest dry spell >= 28 days
        medDryspellDays: number;  // e.g. longest dry spell >= 18 days
        lowRainfallMm: number;    // e.g. dry season rainfall <= 120 mm
      };
      // Flood / excess water risk: determined by wet season total & seasonal variability (CV)
      flood: {
        highRainfallMm: number;   // e.g. wet season rainfall >= 1400 mm
        medRainfallMm: number;    // e.g. wet season rainfall >= 1000 mm
        highVariabilityCv: number; // e.g. rainfall CV >= 0.30
      };
      // Heat risk: determined by mean heat-stress days per dry/hot season
      heat: {
        highHeatDays: number; // e.g. >= 25 days/season >= 35°C
        medHeatDays: number;  // e.g. >= 10 days/season >= 35°C
      };
    };
  };
  scenarios: {
    hotterTempDeltaC: number;      // e.g. +1.5 °C added to T2M and T2M_MAX
    drierPrecipMultiplier: number; // e.g. 0.85 (15% reduction)
    wetterPrecipMultiplier: number; // e.g. 1.15 (15% increase)
    scoringPenalties: {
      heatStressDaysPerYearDelta: number;
      hotterCrops: { low: number; medium: number; high: number };
      drierCrops: { droughtHigh: number; droughtLow: number; highWaterDemand: number };
      wetterCrops: { floodLow: number; floodHigh: number };
      compound: { hotterWeight: number; drierWeight: number };
    };
  };
  api: {
    baseUrl: string;
    timeoutMs: number;
    maxRetries: number;
    backoffBaseMs: number;
    cacheTtlMs: number; // e.g. 30 days
  };
}

export const PILOT_CONFIG: PilotConfig = {
  location: {
    name: 'Science City of Muñoz',
    province: 'Nueva Ecija',
    region: 'Central Luzon (Region III)',
    lat: 15.71715,
    lon: 120.90643,
    elevationMeters: 58
  },
  period: {
    startYear: 2014,
    endYear: 2023,
    startDate: '2014-01-01',
    endDate: '2023-12-31',
    startApiFormat: '20140101',
    endApiFormat: '20231231'
  },
  thresholds: {
    heatStressTempThresholdC: 35.0, // °C (legacy alias for >= 35°C)
    heatStressTempThreshold34C: 34.0, // °C
    heatStressTempThreshold35C: 35.0, // °C
    dryDayPrecipThresholdMm: 1.0,    // mm/day
    maxMissingDayFraction: 0.20,     // 20% max missing days
    seasons: {
      wet: {
        name: 'wet',
        months: [6, 7, 8, 9, 10] // June through October (5 months)
      },
      dry: {
        name: 'dry',
        months: [11, 12, 1, 2, 3, 4, 5]  // November through May (7 months, crosses year boundary)
      },
      dryWindows: {
        coolDry: {
          name: 'coolDry',
          months: [11, 12, 1] // November through January (3 months, crosses year boundary)
        },
        hotDry: {
          name: 'hotDry',
          months: [2, 3, 4, 5] // February through May (4 months)
        }
      }
    },
    // Placeholders needing climate/agronomy review with DA/PhilRice
    riskCriteria: {
      drought: {
        highDryspellDays: 28,
        medDryspellDays: 18,
        lowRainfallMm: 140
      },
      flood: {
        highRainfallMm: 1350,
        medRainfallMm: 950,
        highVariabilityCv: 0.25
      },
      heat: {
        highHeatDays: 25,
        medHeatDays: 10
      }
    }
  },
  scenarios: {
    hotterTempDeltaC: 1.5,
    drierPrecipMultiplier: 0.85,
    wetterPrecipMultiplier: 1.15,
    scoringPenalties: {
      heatStressDaysPerYearDelta: 18,
      hotterCrops: { low: -9, medium: -3, high: 2 },
      drierCrops: { droughtHigh: 3, droughtLow: -10, highWaterDemand: -8 },
      wetterCrops: { floodLow: -16, floodHigh: 6 },
      compound: { hotterWeight: 0.8, drierWeight: 0.85 }
    }
  },
  api: {
    baseUrl: 'https://power.larc.nasa.gov/api/temporal/daily/point',
    timeoutMs: 15000,
    maxRetries: 2,
    backoffBaseMs: 1000,
    cacheTtlMs: TELEMETRY_CACHE_TTL_MS
  }
};

/** Canonical IDs for daily climate scenarios. Rotation results retain their
 * public camel-case combined ID through explicit compatibility adapters. */
export const CLIMATE_SCENARIO_IDS = ['baseline', 'hotter', 'drier', 'wetter', 'hotter_drier'] as const;
export type CanonicalClimateScenarioId = typeof CLIMATE_SCENARIO_IDS[number];
export type CompatibleScenarioId = CanonicalClimateScenarioId | 'hotterAndDrier';
export interface ScenarioDeltas {
  hotterTempDeltaC?: number;
  drierPrecipMultiplier?: number;
  wetterPrecipMultiplier?: number;
}
export function toClimateScenarioId(id: CompatibleScenarioId): CanonicalClimateScenarioId {
  return id === 'hotterAndDrier' ? 'hotter_drier' : id;
}
export function toRotationScenarioId(id: CompatibleScenarioId): import('../types').ScenarioCondition {
  return id === 'hotter_drier' ? 'hotterAndDrier' : id;
}
export function scenarioAdjustment(id: CompatibleScenarioId, deltas?: ScenarioDeltas): {temperatureDeltaC:number;rainfallMultiplier:number} {
  const canonical = toClimateScenarioId(id);
  return {
    temperatureDeltaC: canonical === 'hotter' || canonical === 'hotter_drier' ? deltas?.hotterTempDeltaC ?? PILOT_CONFIG.scenarios.hotterTempDeltaC : 0,
    rainfallMultiplier: canonical === 'drier' || canonical === 'hotter_drier' ? deltas?.drierPrecipMultiplier ?? PILOT_CONFIG.scenarios.drierPrecipMultiplier
      : canonical === 'wetter' ? deltas?.wetterPrecipMultiplier ?? PILOT_CONFIG.scenarios.wetterPrecipMultiplier : 1
  };
}
export interface PilotPresetVerification {
  windowsVerified: boolean;
}

export const PRESET_VERIFICATIONS: Record<string, PilotPresetVerification> = {
  munoz: { windowsVerified: true },
  ilagan: { windowsVerified: true },
  pototan: { windowsVerified: false },
  bukidnon: { windowsVerified: false }
};
