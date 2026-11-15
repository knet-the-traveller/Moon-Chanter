import { describe, expect, it } from 'vitest';
import { summarizeNdvi, isFloodProne, detectBareFieldMonths, coverFactorFromNdvi, estimateErosion } from '../services/landSummary';

const green = Array<number>(12).fill(0.7);

describe('NDVI profile and annual trend', () => {
  it.each([0.1, -0.1, 0])('calculates annual OLS slope %s', (slope) => {
    const result = summarizeNdvi(green, [
      { date: '2020-01-01', value: 0.5 },
      { date: '2021-01-01', value: 0.5 + slope },
      { date: '2022-01-01', value: 0.5 + 2 * slope }
    ], 'sample synthetic');
    expect(result.trend).toBeCloseTo(slope);
    expect(result.trendAvailable).toBe(true);
    expect(result.seasonalMean).toEqual(green);
  });

  it.each([{ annual: [] }, { annual: [{ date: '2020-01-01', value: 0.5 }] }, { annual: [
    { date: '2020-01-01', value: 0.5 }, { date: '2020-01-01', value: 0.6 }
  ] }])('marks unsupported annual trends unavailable', ({ annual }) => {
    const result = summarizeNdvi(green, annual, 'sample synthetic');
    expect(result.trend).toBe(0);
    expect(result.trendAvailable).toBe(false);
    expect(result.trendUnavailableReason).toBeTruthy();
  });

  it('rejects invalid monthly values and impossible observation dates', () => {
    expect(() => summarizeNdvi([NaN], [], 'sample')).toThrow();
    expect(() => summarizeNdvi(green, [{ date: '2020-02-31', value: 0.5 }], 'sample')).toThrow();
  });
});

describe('lowland terrain screen [LAND-RULE-FLOOD]', () => {
  it.each([
    [29.9, 3, true], [30, 3, false], [29, 3.01, false], [10, 2.99, true], [620, 12, false]
  ])('screens elevation %s and slope %s as %s', (elevation, slope, expected) => {
    expect(isFloodProne(Number(elevation), Number(slope))).toBe(expected);
  });
  it('rejects invalid terrain', () => {
    expect(() => isFloodProne(NaN, 2)).toThrow();
    expect(() => isFloodProne(20, -1)).toThrow();
  });
});

const rusleFactors = {
  R: 100, K: 0.02, LS: 2, P: 0.5,
  units: {
    R: 'MJ mm ha-1 h-1 yr-1', K: 't ha h ha-1 MJ-1 mm-1',
    LS: 'dimensionless', P: 'dimensionless'
  }
};

describe('bare-field and RUSLE helpers', () => {
  it('uses a strict threshold and only the fallow window', () => {
    const monthly = Array<number>(12).fill(0.7);
    monthly[0] = 0.1;
    monthly[2] = 0.25;
    monthly[3] = 0.249;
    monthly[5] = 0.1;
    expect(detectBareFieldMonths(monthly)).toEqual([1, 4, 6]);
    expect(detectBareFieldMonths(green)).toEqual([]);
    expect(detectBareFieldMonths(monthly, [6, 4, 4])).toEqual([4, 6]);
    expect(() => detectBareFieldMonths(monthly, [13])).toThrow();
  });

  it('uses a bounded monotonically decreasing cover factor', () => {
    const cover = [-1, 0, 0.25, 0.5, 0.75, 1].map(coverFactorFromNdvi);
    expect(cover).toEqual([1, 1, 0.5625, 0.25, 0.0625, 0]);
    expect(() => coverFactorFromNdvi(NaN)).toThrow();
    expect(() => coverFactorFromNdvi(1.1)).toThrow();
  });

  it('matches a hand-calculated SI result and handles zero factors', () => {
    // 100 × 0.02 × 2 × 0.25 × 0.5 = 0.5 metric tonnes/ha/year.
    const monthly = Array<number>(12).fill(0.5);
    expect(estimateErosion(rusleFactors, monthly)).toBe(0.5);
    expect(estimateErosion({ ...rusleFactors, R: 0 }, monthly)).toBe(0);
    expect(estimateErosion(rusleFactors, Array<number>(12).fill(1))).toBe(0);
    expect(estimateErosion(rusleFactors, monthly)).toBe(estimateErosion(rusleFactors, monthly));
  });

  it('rejects negative, infinite, incompatible, and overflowing factors', () => {
    expect(() => estimateErosion({ ...rusleFactors, K: -1 }, green)).toThrow();
    expect(() => estimateErosion({ ...rusleFactors, R: Infinity }, green)).toThrow();
    expect(() => estimateErosion({ ...rusleFactors, units: {} }, green)).toThrow();
    expect(() => estimateErosion({ ...rusleFactors, R: Number.MAX_VALUE, K: Number.MAX_VALUE }, green)).toThrow();
  });
});
