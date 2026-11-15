import { describe, it, expect } from 'vitest';
import {
  calculateLinearRegressionSlope,
  calculateMeanAndStdDev,
  groupDailySeriesBySeasons,
  summarizeSeasonInstance,
  calculateClimateSummary,
  explainRisks
} from '../../engine/climate/climateSummary';
import type { DailySeries } from '../../services/nasaPower';

describe('Seasonal Boundary & Summarization Logic', () => {
  it('correctly maps dates across the Nov-May year boundary into the same dry season cycle and sub-windows', () => {
    const syntheticSeries: DailySeries = {
      location: { lat: 15.71715, lon: 120.90643 },
      dates: ['2020-10-31', '2020-11-30', '2020-12-01', '2020-12-31', '2021-01-01', '2021-05-31', '2021-06-01'],
      t2m: [25, 24, 23, 22, 28, 29, 30],
      t2mMax: [30, 29, 28, 27, 34, 33, 35],
      prectotcorr: [10, 0, 0, 0, 5, 20, 25],
      rh2m: [80, 75, 75, 70, 68, 85, 80],
      allskySfcSwDwn: [15, 16, 17, 18, 22, 16, 17],
      tier: 'live',
      isSample: false,
      source: 'Test Series'
    };

    const buckets = groupDailySeriesBySeasons(syntheticSeries);

    expect(buckets['2020-wet']?.dates).toEqual(['2020-10-31']);
    expect(buckets['2021-wet']?.dates).toEqual(['2021-06-01']);
    // November 2020 through May 2021 must be grouped into '2020-2021-dry'
    expect(buckets['2020-2021-dry']?.dates).toEqual([
      '2020-11-30',
      '2020-12-01',
      '2020-12-31',
      '2021-01-01',
      '2021-05-31'
    ]);
    // November 2020 through January 2021 must be grouped into '2020-2021-coolDry'
    expect(buckets['2020-2021-coolDry']?.dates).toEqual([
      '2020-11-30',
      '2020-12-01',
      '2020-12-31',
      '2021-01-01'
    ]);
    // May 2021 must be grouped into '2021-hotDry'
    expect(buckets['2021-hotDry']?.dates).toEqual([
      '2021-05-31'
    ]);
  });

  it('accurately calculates longest consecutive dry-spell run on a hand-checkable synthetic fixture', () => {
    // 10-day fixture with rain: [0, 0, 0, 5, 0, 0, 0, 0, 10, 0]
    // Runs of rain < 1mm:
    // First run: 3 days (indices 0, 1, 2)
    // Then 5mm (wet)
    // Second run: 4 days (indices 4, 5, 6, 7)
    // Then 10mm (wet)
    // Third run: 1 day (index 9)
    // Maximum dry spell = 4 days.
    const dates = Array.from({ length: 10 }, (_, i) => `2020-01-${String(i + 1).padStart(2, '0')}`);
    const rain = [0, 0, 0, 5, 0, 0, 0, 0, 10, 0];
    const t2m = [25, 25, 25, 25, 25, 25, 25, 25, 25, 25];
    const t2mMax = [30, 31, 35.5, 32, 36.0, 34, 35.0, 31, 32, 33]; // Heat days (>= 35°C): 3 days (indices 2, 4, 6)

    const instance = summarizeSeasonInstance(
      '2019-2020-dry',
      'dry',
      { dates, t2m, t2mMax, rain },
      35.0, // heatThreshold
      1.0   // dryDayThreshold
    );

    expect(instance.totalRainfallMm).toBe(15);
    expect(instance.maxDrySpellDays).toBe(4);
    expect(instance.heatStressDays).toBe(3);
  });

  it('enforces heat threshold invariant that heatDaysAbove35C <= heatDaysAbove34C', () => {
    const dates = Array.from({ length: 30 }, (_, i) => `2020-04-${String(i + 1).padStart(2, '0')}`);
    const rain = Array(30).fill(0);
    const t2m = Array(30).fill(28);
    // 10 days at 34.5°C (>= 34, < 35), 5 days at 35.5°C (>= 35), 15 days at 30°C
    const t2mMax = Array(30).fill(30);
    for (let i = 0; i < 10; i++) t2mMax[i] = 34.5;
    for (let i = 10; i < 15; i++) t2mMax[i] = 35.5;

    const instance = summarizeSeasonInstance(
      '2020-hotDry',
      'hotDry',
      { dates, t2m, t2mMax, rain }
    );

    expect(instance.heatDaysAbove34C).toBe(15);
    expect(instance.heatDaysAbove35C).toBe(5);
    expect(instance.heatDaysAbove35C).toBeLessThanOrEqual(instance.heatDaysAbove34C);
  });

  it('correctly calculates sample mean, standard deviation, and coefficient of variation', () => {
    // Dataset: [100, 200, 300]
    // Mean = 200
    // Variance = ((100-200)^2 + (200-200)^2 + (300-200)^2) / (3-1) = (10000 + 0 + 10000) / 2 = 10000
    // StdDev = 100
    // CV = 100 / 200 = 0.5
    const stats = calculateMeanAndStdDev([100, 200, 300]);
    expect(stats.mean).toBe(200);
    expect(stats.stdDev).toBe(100);
    expect(stats.cv).toBe(0.5);
  });

  it('correctly calculates linear regression slope across years', () => {
    // Years: [2010, 2011, 2012], Temps: [20, 21, 22] -> slope = 1.0 °C / year
    const slope = calculateLinearRegressionSlope([2010, 2011, 2012], [20, 21, 22]);
    expect(slope).toBeCloseTo(1.0, 4);

    // Negative slope: [2010, 2011, 2012], Rain: [1000, 950, 900] -> slope = -50 mm / year
    const rainSlope = calculateLinearRegressionSlope([2010, 2011, 2012], [1000, 950, 900]);
    expect(rainSlope).toBeCloseTo(-50.0, 4);
  });

  it('computes complete ClimateSummary contract and generates risk explanation', () => {
    // Synthetic 2-year daily series
    const dates: string[] = [];
    const t2m: (number | null)[] = [];
    const t2mMax: (number | null)[] = [];
    const prectotcorr: (number | null)[] = [];
    const rh2m: (number | null)[] = [];
    const allskySfcSwDwn: (number | null)[] = [];

    // Generate 365 * 2 days
    const start = new Date('2020-01-01');
    for (let i = 0; i < 730; i++) {
      const d = new Date(start.getTime() + i * 86400000);
      dates.push(d.toISOString().slice(0, 10));
      const m = d.getMonth() + 1;

      // Wet months (6-10): higher rain, lower heat
      if (m >= 6 && m <= 10) {
        t2m.push(27.0);
        t2mMax.push(31.5);
        prectotcorr.push(10.0);
      } else {
        // Dry months (11-12, 1-5): lower rain, high heat in April/May
        t2m.push(28.0);
        t2mMax.push(m >= 3 && m <= 5 ? 36.0 : 31.0);
        prectotcorr.push(0.5);
      }
      rh2m.push(75);
      allskySfcSwDwn.push(18);
    }

    const series: DailySeries = {
      location: { lat: 15.71715, lon: 120.90643 },
      dates,
      t2m,
      t2mMax,
      prectotcorr,
      rh2m,
      allskySfcSwDwn,
      tier: 'live',
      isSample: false,
      source: 'Synthetic 2-Year Series'
    };

    const summary = calculateClimateSummary(series);

    expect(summary.location).toEqual({ lat: 15.71715, lon: 120.90643 });
    expect(summary.seasons).toHaveLength(2);
    expect(summary.seasons[0].name).toBe('wet');
    expect(summary.seasons[1].name).toBe('dry');
    expect(summary.dryWindows).toBeDefined();
    expect(summary.dryWindows?.coolDry.name).toBe('coolDry');
    expect(summary.dryWindows?.hotDry.name).toBe('hotDry');
    expect(summary.windowsVerified).toBe(true);

    expect(summary.seasons[0].heatDaysAbove35C).toBeLessThanOrEqual(summary.seasons[0].heatDaysAbove34C!);
    expect(summary.seasons[1].heatDaysAbove35C).toBeLessThanOrEqual(summary.seasons[1].heatDaysAbove34C!);

    expect(['low', 'med', 'high']).toContain(summary.risks.drought);
    expect(['low', 'med', 'high']).toContain(summary.risks.flood);
    expect(['low', 'med', 'high']).toContain(summary.risks.heat);

    expect(summary.riskScores).toBeDefined();
    expect(summary.riskScores?.drought).toBeGreaterThanOrEqual(0);
    expect(summary.riskScores?.drought).toBeLessThanOrEqual(100);
    expect(summary.riskScores?.flood).toBeGreaterThanOrEqual(0);
    expect(summary.riskScores?.flood).toBeLessThanOrEqual(100);
    expect(summary.riskScores?.heat).toBeGreaterThanOrEqual(0);
    expect(summary.riskScores?.heat).toBeLessThanOrEqual(100);

    const explanation = explainRisks(summary);
    expect(explanation.drought.explanation).toBeDefined();
    expect(explanation.flood.explanation).toBeDefined();
    expect(explanation.heat.explanation).toBeDefined();
  });
});
