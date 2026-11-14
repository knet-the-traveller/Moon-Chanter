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
    // Rainfall below this threshold is counted as a dry day
    dryDayPrecipThresholdMm: number;
    // Maximum allowable fraction of missing/null days before a season-year is excluded
    maxMissingDayFraction: number;
    // Definition of seasons by month indices (1 = January ... 12 = December)
    seasons: {
      wet: {
        name: 'wet';
        months: number[]; // e.g. [6, 7, 8, 9, 10, 11] (June - November)
      };
      dry: {
        name: 'dry';
        months: number[]; // e.g. [12, 1, 2, 3, 4, 5] (December - May, crosses calendar year)
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
    lat: 15.714,
    lon: 120.906,
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
    heatStressTempThresholdC: 35.0, // °C
    dryDayPrecipThresholdMm: 1.0,    // mm/day
    maxMissingDayFraction: 0.20,     // 20% max missing days
    seasons: {
      wet: {
        name: 'wet',
        months: [6, 7, 8, 9, 10, 11] // June through November
      },
      dry: {
        name: 'dry',
        months: [12, 1, 2, 3, 4, 5]  // December through May (crosses year boundary)
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
    wetterPrecipMultiplier: 1.15
  },
  api: {
    baseUrl: 'https://power.larc.nasa.gov/api/temporal/daily/point',
    timeoutMs: 15000,
    maxRetries: 2,
    backoffBaseMs: 1000,
    cacheTtlMs: 1000 * 60 * 60 * 24 * 30 // 30 days
  }
};
