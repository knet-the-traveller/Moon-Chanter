import { describe, it, expect } from 'vitest';
import { parsePowerDailyPayload, sanitizePowerValue, formatApiDateToIso } from '../../services/nasaPower';

describe('NASA POWER Daily Series Parser & Null Handling', () => {
  it('correctly converts date string YYYYMMDD to ISO YYYY-MM-DD', () => {
    expect(formatApiDateToIso('20230515')).toBe('2023-05-15');
    expect(formatApiDateToIso('20140101')).toBe('2014-01-01');
  });

  it('treats NASA POWER missing fill code -999 and -999.00 as null, never a number', () => {
    expect(sanitizePowerValue(-999)).toBeNull();
    expect(sanitizePowerValue(-999.0)).toBeNull();
    expect(sanitizePowerValue(-9999)).toBeNull();
    expect(sanitizePowerValue(null)).toBeNull();
    expect(sanitizePowerValue(undefined)).toBeNull();
    expect(sanitizePowerValue(NaN)).toBeNull();

    // Valid zero and negative temperatures must be preserved
    expect(sanitizePowerValue(0)).toBe(0);
    expect(sanitizePowerValue(-5.2)).toBe(-5.2);
    expect(sanitizePowerValue(28.4)).toBe(28.4);
  });

  it('parses synthetic POWER-style payload into typed DailySeries', () => {
    const syntheticPayload = {
      properties: {
        parameter: {
          T2M: {
            '20200101': 24.5,
            '20200102': -999,
            '20200103': 26.0
          },
          T2M_MAX: {
            '20200101': 30.1,
            '20200102': -999,
            '20200103': 32.5
          },
          PRECTOTCORR: {
            '20200101': 0.0,
            '20200102': 12.4,
            '20200103': -999
          },
          RH2M: {
            '20200101': 75.0,
            '20200102': 82.0,
            '20200103': 70.0
          },
          ALLSKY_SFC_SW_DWN: {
            '20200101': 18.2,
            '20200102': 14.5,
            '20200103': 20.1
          }
        }
      }
    };

    const location = { lat: 15.714, lon: 120.906 };
    const series = parsePowerDailyPayload(syntheticPayload, location, 'live', 'Synthetic Test');

    expect(series.dates).toEqual(['2020-01-01', '2020-01-02', '2020-01-03']);
    expect(series.t2m).toEqual([24.5, null, 26.0]);
    expect(series.t2mMax).toEqual([30.1, null, 32.5]);
    expect(series.prectotcorr).toEqual([0.0, 12.4, null]);
    expect(series.tier).toBe('live');
    expect(series.isSample).toBe(false);
  });
});
