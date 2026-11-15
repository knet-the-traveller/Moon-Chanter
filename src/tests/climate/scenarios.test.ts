import { describe, it, expect } from 'vitest';
import { applyScenario, summarizeAllScenarios } from '../../engine/climate/scenarios';
import { calculateClimateSummary } from '../../engine/climate/climateSummary';
import type { DailySeries } from '../../services/nasaPower';

describe('Climate Scenarios Sensitivity Transformations', () => {
  const syntheticSeries: DailySeries = {
    location: { lat: 15.714, lon: 120.906 },
    dates: ['2020-07-01', '2020-07-02', '2020-07-03'],
    t2m: [26.0, 27.0, 28.0],
    t2mMax: [31.0, 32.0, 34.0],
    prectotcorr: [10.0, 20.0, 0.0],
    rh2m: [80, 85, 75],
    allskySfcSwDwn: [16, 18, 20],
    tier: 'live',
    isSample: false,
    source: 'Scenario Synthetic Series'
  };

  it('preserves exact baseline values under baseline scenario', () => {
    const transformed = applyScenario(syntheticSeries, 'baseline');
    expect(transformed.t2m).toEqual(syntheticSeries.t2m);
    expect(transformed.t2mMax).toEqual(syntheticSeries.t2mMax);
    expect(transformed.prectotcorr).toEqual(syntheticSeries.prectotcorr);
  });

  it('adds +1.5°C to T2M and T2M_MAX under hotter scenario while keeping rainfall unchanged', () => {
    const transformed = applyScenario(syntheticSeries, 'hotter', { hotterTempDeltaC: 1.5 });
    expect(transformed.t2m).toEqual([27.5, 28.5, 29.5]);
    expect(transformed.t2mMax).toEqual([32.5, 33.5, 35.5]); // 34.0 becomes 35.5 (heat stress threshold crossed!)
    expect(transformed.prectotcorr).toEqual(syntheticSeries.prectotcorr);
  });

  it('shifts actual daily minima in hotter scenarios, preserves nulls, and leaves the baseline immutable',()=>{
    const series={...syntheticSeries,t2mMin:[20,null,22]};
    expect(applyScenario(series,'hotter').t2mMin).toEqual([21.5,null,23.5]);
    expect(applyScenario(series,'hotter_drier').t2mMin).toEqual([21.5,null,23.5]);
    expect(applyScenario(series,'drier').t2mMin).toEqual([20,null,22]);
    expect(applyScenario(series,'wetter').t2mMin).toEqual([20,null,22]);
    expect(series.t2mMin).toEqual([20,null,22]);
    expect(applyScenario(syntheticSeries,'hotter').t2mMin).toBeUndefined();
  });

  it('multiplies rainfall by 0.85 under drier scenario while keeping temperatures unchanged', () => {
    const transformed = applyScenario(syntheticSeries, 'drier', { drierPrecipMultiplier: 0.85 });
    expect(transformed.t2m).toEqual(syntheticSeries.t2m);
    expect(transformed.prectotcorr).toEqual([8.5, 17.0, 0.0]);
  });

  it('multiplies rainfall by 1.15 under wetter scenario', () => {
    const transformed = applyScenario(syntheticSeries, 'wetter', { wetterPrecipMultiplier: 1.15 });
    expect(transformed.prectotcorr).toEqual([11.5, 23.0, 0.0]);
  });

  it('applies both temperature increase and rainfall reduction under hotter_drier scenario', () => {
    const transformed = applyScenario(syntheticSeries, 'hotter_drier');
    expect(transformed.t2m[0]).toBe(27.5);
    expect(transformed.t2mMax[0]).toBe(32.5);
    expect(transformed.prectotcorr[0]).toBe(8.5);
  });

  it('summarizes all 5 scenarios and confirms baseline equals unmodified summary', () => {
    // Generate full-year series
    const dates: string[] = [];
    const t2m: number[] = [];
    const t2mMax: number[] = [];
    const prectotcorr: number[] = [];
    const rh2m: number[] = [];
    const allskySfcSwDwn: number[] = [];

    const start = new Date('2020-01-01');
    for (let i = 0; i < 365; i++) {
      const d = new Date(start.getTime() + i * 86400000);
      dates.push(d.toISOString().slice(0, 10));
      t2m.push(26.5);
      t2mMax.push(33.0);
      prectotcorr.push(5.0);
      rh2m.push(75);
      allskySfcSwDwn.push(18);
    }

    const yearSeries: DailySeries = {
      location: { lat: 15.714, lon: 120.906 },
      dates,
      t2m,
      t2mMax,
      prectotcorr,
      rh2m,
      allskySfcSwDwn,
      tier: 'live',
      isSample: false,
      source: 'Full Year Series'
    };

    const scenarioSummaries = summarizeAllScenarios(yearSeries);

    expect(scenarioSummaries.baseline).toBeDefined();
    expect(scenarioSummaries.hotter).toBeDefined();
    expect(scenarioSummaries.drier).toBeDefined();
    expect(scenarioSummaries.wetter).toBeDefined();
    expect(scenarioSummaries.hotter_drier).toBeDefined();

    // Baseline must exactly equal direct calculateClimateSummary
    const directBaseline = calculateClimateSummary(yearSeries);
    expect(scenarioSummaries.baseline.seasons[0].rainfallMm).toBe(directBaseline.seasons[0].rainfallMm);
    expect(scenarioSummaries.baseline.seasons[0].meanTempC).toBe(directBaseline.seasons[0].meanTempC);

    // Wetter must have higher seasonal rainfall than Drier
    const wetSeasonWetter = scenarioSummaries.wetter.seasons.find((s) => s.name === 'wet')!;
    const wetSeasonDrier = scenarioSummaries.drier.seasons.find((s) => s.name === 'wet')!;
    expect(wetSeasonWetter.rainfallMm).toBeGreaterThan(wetSeasonDrier.rainfallMm);
  });
});
