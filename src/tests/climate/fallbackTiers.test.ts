import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchDailySeries } from '../../services/nasaPower';
import { CacheService } from '../../services/cache';

describe('NASA POWER Service Fallback Hierarchy (Live -> Cache -> Sample)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    await CacheService.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('serves LIVE tier and marks isSample=false when live API succeeds', async () => {
    const mockPayload = {
      properties: {
        parameter: {
          T2M: { '20200101': 25.0 },
          T2M_MAX: { '20200101': 31.0 },
          PRECTOTCORR: { '20200101': 5.0 },
          RH2M: { '20200101': 75.0 },
          ALLSKY_SFC_SW_DWN: { '20200101': 18.0 }
        }
      }
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockPayload
    });

    const series = await fetchDailySeries({ maxRetries: 0 });
    expect(series.tier).toBe('live');
    expect(series.isSample).toBe(false);
  });

  it('falls back to CACHE tier and marks isSample=false when live API fails but cache exists', async () => {
    const cachedPayload = {
      properties: {
        parameter: {
          T2M: { '20200101': 24.2 },
          T2M_MAX: { '20200101': 30.5 },
          PRECTOTCORR: { '20200101': 2.0 },
          RH2M: { '20200101': 70.0 },
          ALLSKY_SFC_SW_DWN: { '20200101': 19.0 }
        }
      }
    };

    // Pre-populate cache
    const cacheKey = `nasa_power_daily_15.714_120.906_20140101_20231231`;
    await CacheService.set(cacheKey, cachedPayload);

    // Mock live API failure
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'));

    const series = await fetchDailySeries({ maxRetries: 0 });
    expect(series.tier).toBe('cache');
    expect(series.isSample).toBe(false);
    expect(series.t2m[0]).toBe(24.2);
  });

  it('falls back to BUNDLED SAMPLE tier and marks isSample=true when both live API and cache fail', async () => {
    // Empty cache
    await CacheService.clear();

    // Mock live API failure
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network unreachable'));

    const series = await fetchDailySeries({ maxRetries: 0 });
    expect(series.tier).toBe('sample');
    expect(series.isSample).toBe(true);
    expect(series.dates.length).toBeGreaterThan(3000);
  });
});
