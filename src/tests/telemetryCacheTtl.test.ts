import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CacheService, TELEMETRY_CACHE_TTL_MS } from '../services/cache';
import { PILOT_CONFIG } from '../config/pilot';
import { fetchNasaPowerClimate } from '../services/nasaPower';
import { fetchSoilGridsData } from '../services/soilGrids';

beforeEach(async () => { await CacheService.clear(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('seven-day telemetry cache wiring', () => {
  it('expires an explicitly cached value after seven days', async () => {
    vi.useFakeTimers();
    expect(TELEMETRY_CACHE_TTL_MS).toBe(604800000);
    expect(PILOT_CONFIG.api.cacheTtlMs).toBe(TELEMETRY_CACHE_TTL_MS);
    await CacheService.set('ttl-test', { value: 1 }, TELEMETRY_CACHE_TTL_MS);
    expect(await CacheService.get('ttl-test')).toEqual({ value: 1 });
    vi.advanceTimersByTime(TELEMETRY_CACHE_TTL_MS + 1);
    expect(await CacheService.get('ttl-test')).toBeNull();
  });

  it('passes seven days from daily and legacy climate callers', async () => {
    const set = vi.spyOn(CacheService, 'set');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({
      properties: { parameter: { T2M: { '20200101': 25 }, T2M_MAX: { '20200101': 30 }, PRECTOTCORR: { '20200101': 5 } } }
    }) }));
    await fetchNasaPowerClimate(15.714, 120.906);
    expect(set).toHaveBeenCalledTimes(2);
    expect(set.mock.calls.every((call) => call[2] === TELEMETRY_CACHE_TTL_MS)).toBe(true);
  });

  it('passes seven days from the soil caller', async () => {
    const set = vi.spyOn(CacheService, 'set');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ properties: { layers: [{ name: 'soc', depths: [{ label: '0-5cm', values: { mean: 100 } }, { label: '5-15cm', values: { mean: 100 } }] }] } }) }));
    await fetchSoilGridsData(15.714, 120.906);
    expect(set).toHaveBeenCalledWith(expect.stringContaining('soilgrids_'), expect.any(Object), TELEMETRY_CACHE_TTL_MS);
  });
});
