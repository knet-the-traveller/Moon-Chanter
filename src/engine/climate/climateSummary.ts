import type { DailySeries } from '../../services/nasaPower';
import type { ClimateSummary, SeasonalMetrics } from '../../types/contracts';
import { PILOT_CONFIG, PRESET_VERIFICATIONS } from '../../config/pilot';
import { PLANNING_CALENDAR_VERSION, seasonalBounds } from '../../config/planningCalendar';

export interface SeasonInstance {
  seasonKey: 'wet' | 'dry' | 'coolDry' | 'hotDry';
  cycleId: string; // e.g. "2014-wet" or "2014-2015-dry" or "2014-2015-coolDry" or "2015-hotDry"
  totalDays: number;
  validDays: number;
  missingDays: number;
  meanT2m: number;
  totalRainfallMm: number;
  maxDrySpellDays: number;
  heatStressDays: number;
  heatDaysAbove34C: number;
  heatDaysAbove35C: number;
  heavyRainDays: number;
}

export interface RiskExplanation {
  drought: {
    level: 'low' | 'med' | 'high';
    drySeasonRainfallMm: number;
    avgLongestDrySpellDays: number;
    explanation: string;
  };
  flood: {
    level: 'low' | 'med' | 'high';
    wetSeasonRainfallMm: number;
    rainfallVariabilityCv: number;
    explanation: string;
  };
  heat: {
    level: 'low' | 'med' | 'high';
    heatStressDaysPerSeason: number;
    thresholdC: number;
    explanation: string;
  };
}

/**
 * Pure calculation of linear regression slope: y = m*x + b
 * Returns slope m (change in y per unit of x).
 */
export function calculateLinearRegressionSlope(xValues: number[], yValues: number[]): number {
  const n = xValues.length;
  if (n < 2) return 0;

  const meanX = xValues.reduce((a, b) => a + b, 0) / n;
  const meanY = yValues.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    const dx = xValues[i] - meanX;
    const dy = yValues[i] - meanY;
    numerator += dx * dy;
    denominator += dx * dx;
  }

  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Pure calculation of sample mean and standard deviation.
 */
export function calculateMeanAndStdDev(values: number[]): { mean: number; stdDev: number; cv: number } {
  if (values.length === 0) {
    return { mean: 0, stdDev: 0, cv: 0 };
  }
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (values.length === 1) {
    return { mean, stdDev: 0, cv: 0 };
  }

  const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (values.length - 1);
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? stdDev / mean : 0;

  return { mean, stdDev, cv };
}

/**
 * Pure helper: determine if preset seasonal windows are verified for coordinates.
 */
export function resolveWindowsVerified(lat: number, lon: number, explicit?: boolean): boolean {
  if (explicit !== undefined) return explicit;
  const presets = [
    { id: 'munoz', lat: 15.71715, lon: 120.90643 },
    { id: 'ilagan', lat: 16.975, lon: 121.810 },
    { id: 'pototan', lat: 10.952, lon: 122.632 },
    { id: 'bukidnon', lat: 8.15558, lon: 125.12834 }
  ];
  for (const p of presets) {
    if (Math.abs(p.lat - lat) < 0.2 && Math.abs(p.lon - lon) < 0.2) {
      const verification = PRESET_VERIFICATIONS[p.id];
      return verification?.calendarVersion === PLANNING_CALENDAR_VERSION && verification.windowsVerified;
    }
  }
  return false;
}

/**
 * Group daily series by seasonal cycles, correctly handling non-overlapping windows:
 * - Wet: June 1 – October 31 (months 6-10)
 * - Dry (Aggregate): November 1 – May 31 (months 11-12, 1-5, crosses calendar year)
 *   - coolDry: November 1 – February 28/29 (months 11-12, 1-2)
 *   - hotDry: March 1 – May 31 (months 3-5)
 */
export function groupDailySeriesBySeasons(
  series: DailySeries
): Record<string, { dates: string[]; t2m: (number | null)[]; t2mMax: (number | null)[]; rain: (number | null)[] }> {
  const buckets: Record<string, { dates: string[]; t2m: (number | null)[]; t2mMax: (number | null)[]; rain: (number | null)[] }> = {};

  const wetMonths = new Set(PILOT_CONFIG.thresholds.seasons.wet.months);
  const coolDryMonths = new Set(PILOT_CONFIG.thresholds.seasons.dryWindows.coolDry.months);
  const hotDryMonths = new Set(PILOT_CONFIG.thresholds.seasons.dryWindows.hotDry.months);

  const pushToBucket = (cycleId: string, idx: number, dateStr: string) => {
    if (!buckets[cycleId]) {
      buckets[cycleId] = { dates: [], t2m: [], t2mMax: [], rain: [] };
    }
    buckets[cycleId].dates.push(dateStr);
    buckets[cycleId].t2m.push(series.t2m[idx]);
    buckets[cycleId].t2mMax.push(series.t2mMax[idx]);
    buckets[cycleId].rain.push(series.prectotcorr[idx]);
  };

  series.dates.forEach((dateStr, idx) => {
    const year = parseInt(dateStr.slice(0, 4), 10);
    const month = parseInt(dateStr.slice(5, 7), 10);

    if (wetMonths.has(month)) {
      pushToBucket(`${year}-wet`, idx, dateStr);
    } else if (coolDryMonths.has(month)) {
      // November or December: start of dry season in this year (e.g. Nov 2014 -> 2014-2015-dry)
      // January/February belong to the dry cycle that began the previous year.
      const dryStartYear = month < PILOT_CONFIG.thresholds.seasons.dry.months[0] ? year - 1 : year;
      pushToBucket(`${dryStartYear}-${dryStartYear + 1}-dry`, idx, dateStr);
      pushToBucket(`${dryStartYear}-${dryStartYear + 1}-coolDry`, idx, dateStr);
    } else if (hotDryMonths.has(month)) {
      // March-May: tail of the dry season that started the previous year.
      // and hotDry window for the current calendar year (e.g. 2015-hotDry)
      pushToBucket(`${year - 1}-${year}-dry`, idx, dateStr);
      pushToBucket(`${year}-hotDry`, idx, dateStr);
    }
  });

  return buckets;
}

/**
 * Summarize an individual season instance.
 */
export function summarizeSeasonInstance(
  cycleId: string,
  seasonKey: 'wet' | 'dry' | 'coolDry' | 'hotDry',
  data: { dates: string[]; t2m: (number | null)[]; t2mMax: (number | null)[]; rain: (number | null)[] },
  heatThresholdC: number = PILOT_CONFIG.thresholds.heatStressTempThresholdC,
  dryDayThresholdMm: number = PILOT_CONFIG.thresholds.dryDayPrecipThresholdMm,
  heatThreshold34C: number = PILOT_CONFIG.thresholds.heatStressTempThreshold34C,
  heatThreshold35C: number = PILOT_CONFIG.thresholds.heatStressTempThreshold35C,
  heavyRainThresholdMm: number = 50.0
): SeasonInstance {
  const totalDays = data.dates.length;
  let missingDays = 0;
  let t2mSum = 0;
  let t2mCount = 0;
  let rainSum = 0;
  let heatDaysLegacy = 0;
  let heatDays34 = 0;
  let heatDays35 = 0;
  let heavyRainDays = 0;

  let currentDrySpell = 0;
  let maxDrySpell = 0;

  for (let i = 0; i < totalDays; i++) {
    const t = data.t2m[i];
    const tm = data.t2mMax[i];
    const r = data.rain[i];

    if (t == null || r == null || tm == null) missingDays++;
    // Coverage uses all required variables, but each metric retains its own
    // valid observations. Missing temperature must not erase measured rain.
    if (t != null) {
      t2mSum += t;
      t2mCount++;
    }
    if (r != null) {
      rainSum += r;

      if (i > 0 && Date.parse(data.dates[i]) - Date.parse(data.dates[i - 1]) !== 86400000) currentDrySpell = 0;
      if (r < dryDayThresholdMm) {
        currentDrySpell++;
        if (currentDrySpell > maxDrySpell) {
          maxDrySpell = currentDrySpell;
        }
      } else {
        currentDrySpell = 0;
      }

      if (r >= heavyRainThresholdMm) {
        heavyRainDays++;
      }
    } else {
      currentDrySpell = 0;
    }

    if (tm != null) {
      if (tm >= heatThresholdC) {
        heatDaysLegacy++;
      }
      if (tm >= heatThreshold34C) {
        heatDays34++;
      }
      if (tm >= heatThreshold35C) {
        heatDays35++;
      }
    }
  }

  const validDays = totalDays - missingDays;
  const meanT2m = t2mCount > 0 ? t2mSum / t2mCount : 0;

  return {
    seasonKey,
    cycleId,
    totalDays,
    validDays,
    missingDays,
    meanT2m,
    totalRainfallMm: rainSum,
    maxDrySpellDays: maxDrySpell,
    heatStressDays: heatDaysLegacy, // Configured threshold; 35°C by default.
    heatDaysAbove34C: heatDays34,
    heatDaysAbove35C: heatDays35,
    heavyRainDays
  };
}

/**
 * Pure function: turn a DailySeries into a ClimateSummary contract.
 */
export function calculateClimateSummary(
  series: DailySeries,
  options?: {
    heatThresholdC?: number;
    dryDayThresholdMm?: number;
    maxMissingDayFraction?: number;
    windowsVerified?: boolean;
  }
): ClimateSummary {
  const heatThresholdC = options?.heatThresholdC ?? PILOT_CONFIG.thresholds.heatStressTempThresholdC;
  const dryDayThresholdMm = options?.dryDayThresholdMm ?? PILOT_CONFIG.thresholds.dryDayPrecipThresholdMm;
  const maxMissingFraction = options?.maxMissingDayFraction ?? PILOT_CONFIG.thresholds.maxMissingDayFraction;

  const seasonalBuckets = groupDailySeriesBySeasons(series);

  const wetInstances: SeasonInstance[] = [];
  const dryInstances: SeasonInstance[] = [];
  const coolDryInstances: SeasonInstance[] = [];
  const hotDryInstances: SeasonInstance[] = [];

  for (const [cycleId, data] of Object.entries(seasonalBuckets)) {
    let seasonKey: 'wet' | 'dry' | 'coolDry' | 'hotDry' = 'dry';
    let year = Number(cycleId.slice(0, 4));
    let expectedStart = 0;
    let expectedEnd = 0;
    let minDays = 60;

    if (cycleId.endsWith('-wet')) {
      seasonKey = 'wet';
      ({start: expectedStart, end: expectedEnd} = seasonalBounds(year, PILOT_CONFIG.thresholds.seasons.wet.months));
      minDays = 60;
    } else if (cycleId.endsWith('-coolDry')) {
      seasonKey = 'coolDry';
      year = Number(cycleId.split('-')[0]);
      ({start: expectedStart, end: expectedEnd} = seasonalBounds(year, PILOT_CONFIG.thresholds.seasons.dryWindows.coolDry.months));
      minDays = 30;
    } else if (cycleId.endsWith('-hotDry')) {
      seasonKey = 'hotDry';
      ({start: expectedStart, end: expectedEnd} = seasonalBounds(year, PILOT_CONFIG.thresholds.seasons.dryWindows.hotDry.months));
      minDays = 30;
    } else if (cycleId.endsWith('-dry')) {
      seasonKey = 'dry';
      year = Number(cycleId.split('-')[0]);
      ({start: expectedStart, end: expectedEnd} = seasonalBounds(year, PILOT_CONFIG.thresholds.seasons.dry.months));
      minDays = 60;
    }

    const instance = summarizeSeasonInstance(
      cycleId,
      seasonKey,
      data,
      heatThresholdC,
      dryDayThresholdMm,
      PILOT_CONFIG.thresholds.heatStressTempThreshold34C,
      PILOT_CONFIG.thresholds.heatStressTempThreshold35C,
      50.0
    );

    // Skip season instance if too incomplete (> maxMissingDayFraction)
    const missingFraction = instance.totalDays > 0 ? instance.missingDays / instance.totalDays : 1;
    const expectedDays = (expectedEnd - expectedStart) / 86400000;
    const calendarMissing = 1 - instance.validDays / expectedDays;

    if (missingFraction <= maxMissingFraction && calendarMissing <= maxMissingFraction && instance.totalDays >= minDays) {
      if (seasonKey === 'wet') {
        wetInstances.push(instance);
      } else if (seasonKey === 'dry') {
        dryInstances.push(instance);
      } else if (seasonKey === 'coolDry') {
        coolDryInstances.push(instance);
      } else if (seasonKey === 'hotDry') {
        hotDryInstances.push(instance);
      }
    }
  }

  // Calculate seasonal aggregate means across years
  const aggregateSeason = (name: 'wet' | 'dry' | 'coolDry' | 'hotDry', instances: SeasonInstance[]): SeasonalMetrics & { heavyRainDays?: number } => {
    if (instances.length === 0) {
      return {
        name,
        meanTempC: 0,
        rainfallMm: 0,
        rainfallVariability: 0,
        dryspellDaysAvg: 0,
        heatStressDays: 0,
        heatDaysAbove34C: 0,
        heatDaysAbove35C: 0,
        heavyRainDays: 0
      };
    }

    const t2mMean = instances.reduce((a, b) => a + b.meanT2m, 0) / instances.length;
    const rainStats = calculateMeanAndStdDev(instances.map((i) => i.totalRainfallMm));
    const drySpellMean = instances.reduce((a, b) => a + b.maxDrySpellDays, 0) / instances.length;
    const heatDaysMean = instances.reduce((a, b) => a + b.heatStressDays, 0) / instances.length;
    const heat34Mean = instances.reduce((a, b) => a + b.heatDaysAbove34C, 0) / instances.length;
    const heat35Mean = instances.reduce((a, b) => a + b.heatDaysAbove35C, 0) / instances.length;
    const heavyRainMean = instances.reduce((a, b) => a + b.heavyRainDays, 0) / instances.length;

    return {
      name,
      meanTempC: Number(t2mMean.toFixed(1)),
      rainfallMm: Math.round(rainStats.mean),
      rainfallVariability: Number(rainStats.cv.toFixed(2)),
      dryspellDaysAvg: Number(drySpellMean.toFixed(1)),
      heatStressDays: Number(heatDaysMean.toFixed(1)),
      heatDaysAbove34C: Number(heat34Mean.toFixed(1)),
      heatDaysAbove35C: Number(heat35Mean.toFixed(1)),
      heavyRainDays: Number(heavyRainMean.toFixed(1))
    };
  };

  const wetSummary = { ...aggregateSeason('wet', wetInstances), name: 'wet' as const };
  const drySummary = { ...aggregateSeason('dry', dryInstances), name: 'dry' as const };
  const coolDrySummary = {
    ...aggregateSeason('coolDry', coolDryInstances),
    name: 'coolDry' as const,
    months: [...PILOT_CONFIG.thresholds.seasons.dryWindows.coolDry.months]
  };
  const hotDrySummary = {
    ...aggregateSeason('hotDry', hotDryInstances),
    name: 'hotDry' as const,
    months: [...PILOT_CONFIG.thresholds.seasons.dryWindows.hotDry.months]
  };

  // 10-Year Decadal Linear Regression Trend
  // Group annual totals by calendar year
  const annualMap: Record<number, { temps: number[]; rain: number[] }> = {};
  series.dates.forEach((dStr, idx) => {
    const y = parseInt(dStr.slice(0, 4), 10);
    if (!annualMap[y]) annualMap[y] = { temps: [], rain: [] };
    const t = series.t2m[idx];
    const r = series.prectotcorr[idx];
    if (t !== null) annualMap[y].temps.push(t);
    if (r !== null) annualMap[y].rain.push(r);
  });

  const years = Object.keys(annualMap).map(Number).sort((a, b) => a - b);
  const acceptedYears: number[] = [];
  const annualAvgTemps: number[] = [];
  const annualTotalRains: number[] = [];

  years.forEach((y) => {
    const b = annualMap[y];
    const expectedDays = (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1)) / 86400000;
    const avgT = b.temps.length === expectedDays ? b.temps.reduce((x, z) => x + z, 0) / b.temps.length : null;
    const totR = b.rain.length === expectedDays ? b.rain.reduce((x, z) => x + z, 0) : null;
    if (avgT !== null && totR !== null) {
      acceptedYears.push(y);
      annualAvgTemps.push(avgT);
      annualTotalRains.push(totR);
    }
  });

  let tempDecadeSlope = 0;
  let rainDecadePct = 0;

  if (years.length >= 3 && annualAvgTemps.length >= 3) {
    const xSeq = acceptedYears;
    const mTemp = calculateLinearRegressionSlope(xSeq, annualAvgTemps);
    const mRain = calculateLinearRegressionSlope(xSeq, annualTotalRains);

    tempDecadeSlope = Number((mTemp * 10).toFixed(2));

    const meanAnnualRain = annualTotalRains.reduce((a, b) => a + b, 0) / annualTotalRains.length;
    rainDecadePct = meanAnnualRain > 0 ? Number(((mRain * 10 / meanAnnualRain) * 100).toFixed(1)) : 0;
  }

  // Risk Classification
  const criteria = PILOT_CONFIG.thresholds.riskCriteria;

  // Drought risk: from low dry season rainfall & long dry spells
  let droughtRisk: 'low' | 'med' | 'high' = 'low';
  if (drySummary.dryspellDaysAvg >= criteria.drought.highDryspellDays || drySummary.rainfallMm <= criteria.drought.lowRainfallMm) {
    droughtRisk = 'high';
  } else if (drySummary.dryspellDaysAvg >= criteria.drought.medDryspellDays) {
    droughtRisk = 'med';
  }

  // Flood risk: from wet season rainfall & seasonal variability
  let floodRisk: 'low' | 'med' | 'high' = 'low';
  if (wetSummary.rainfallMm >= criteria.flood.highRainfallMm || (wetSummary.rainfallMm >= criteria.flood.medRainfallMm && wetSummary.rainfallVariability >= criteria.flood.highVariabilityCv)) {
    floodRisk = 'high';
  } else if (wetSummary.rainfallMm >= criteria.flood.medRainfallMm) {
    floodRisk = 'med';
  }

  // Heat risk: from mean heat-stress days in dry/hot season
  let heatRisk: 'low' | 'med' | 'high' = 'low';
  if (drySummary.heatStressDays >= criteria.heat.highHeatDays) {
    heatRisk = 'high';
  } else if (drySummary.heatStressDays >= criteria.heat.medHeatDays) {
    heatRisk = 'med';
  }

  // Continuous Risk Scores (0-100)
  const droughtScore = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        ((550 - drySummary.rainfallMm) / (550 - 250) * 60) +
        ((drySummary.dryspellDaysAvg - 10) / (30 - 10) * 40)
      )
    )
  );

  const wetHeavyRain = wetSummary.heavyRainDays ?? 0;
  const floodScore = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        ((wetHeavyRain - 4) / (14 - 4) * 70) +
        (wetSummary.rainfallVariability * 100 * 0.3)
      )
    )
  );

  const heatScore = Math.min(
    100,
    Math.max(
      0,
      Math.round(((drySummary.heatStressDays - 20) / (90 - 20)) * 100)
    )
  );

  const startDate = series.dates[0] || PILOT_CONFIG.period.startDate;
  const endDate = series.dates[series.dates.length - 1] || PILOT_CONFIG.period.endDate;

  return {
    location: series.location,
    calendarVersion: PLANNING_CALENDAR_VERSION,
    heatThresholdC,
    period: { start: startDate, end: endDate },
    seasons: [wetSummary, drySummary],
    planningSeasons: [
      {...wetSummary, months: [...PILOT_CONFIG.thresholds.seasons.wet.months]},
      coolDrySummary,
      hotDrySummary
    ],
    dryWindows: {
      coolDry: coolDrySummary,
      hotDry: hotDrySummary
    },
    windowsVerified: resolveWindowsVerified(series.location.lat, series.location.lon, options?.windowsVerified),
    trend10y: {
      tempC: tempDecadeSlope,
      rainfallPct: rainDecadePct
    },
    risks: {
      drought: droughtRisk,
      flood: floodRisk,
      heat: heatRisk
    },
    riskScores: {
      drought: droughtScore,
      flood: floodScore,
      heat: heatScore
    },
    sources: [series.source],
    isSample: series.isSample
  };
}

/**
 * Explain risk levels with the exact numbers behind each decision.
 */
export function explainRisks(summary: ClimateSummary): RiskExplanation {
  const wet = summary.seasons.find((s) => s.name === 'wet') ?? summary.seasons[0];
  const dry = summary.seasons.find((s) => s.name === 'dry') ?? summary.seasons[1];
  const criteria = PILOT_CONFIG.thresholds.riskCriteria;
  const heatThresholdC = summary.heatThresholdC ?? PILOT_CONFIG.thresholds.heatStressTempThresholdC;

  const droughtExplanation =
    summary.risks.drought === 'high'
      ? `High drought risk triggered: average longest dry spell reaches ${dry.dryspellDaysAvg} consecutive days (threshold >= ${criteria.drought.highDryspellDays}) and/or dry-season rainfall is ${dry.rainfallMm} mm (low-rain threshold <= ${criteria.drought.lowRainfallMm} mm).`
      : summary.risks.drought === 'med'
      ? `Moderate drought risk: average longest dry spell of ${dry.dryspellDaysAvg} days exceeds the warning threshold of ${criteria.drought.medDryspellDays} days.`
      : `Low drought risk: dry spell average (${dry.dryspellDaysAvg} days) remains below critical limits.`;

  const floodExplanation =
    summary.risks.flood === 'high'
      ? `High flood/waterlog risk: wet season precipitation averages ${wet.rainfallMm} mm (threshold >= ${criteria.flood.highRainfallMm} mm) with seasonal coefficient of variation of ${wet.rainfallVariability}.`
      : summary.risks.flood === 'med'
      ? `Moderate flood risk: wet season precipitation of ${wet.rainfallMm} mm requires adequate field ditch drainage.`
      : `Low preliminary rainfall screen: wet-season rainfall is ${wet.rainfallMm} mm. This does not establish field infiltration capacity or flood safety.`;

  const heatExplanation =
    summary.risks.heat === 'high'
      ? `High heat stress risk: an average of ${dry.heatStressDays} days per season reach or exceed ${heatThresholdC}°C, posing flowering abortion hazards.`
      : summary.risks.heat === 'med'
      ? `Moderate heat risk: ${dry.heatStressDays} days/season reach ${heatThresholdC}°C.`
      : `Low heat risk: temperatures rarely breach the ${heatThresholdC}°C threshold (${dry.heatStressDays} days/season).`;

  return {
    drought: {
      level: summary.risks.drought,
      drySeasonRainfallMm: dry.rainfallMm,
      avgLongestDrySpellDays: dry.dryspellDaysAvg,
      explanation: droughtExplanation
    },
    flood: {
      level: summary.risks.flood,
      wetSeasonRainfallMm: wet.rainfallMm,
      rainfallVariabilityCv: wet.rainfallVariability,
      explanation: floodExplanation
    },
    heat: {
      level: summary.risks.heat,
      heatStressDaysPerSeason: dry.heatStressDays,
      thresholdC: heatThresholdC,
      explanation: heatExplanation
    }
  };
}
