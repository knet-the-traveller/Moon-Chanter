vi.mock('../services/realLandData', () => ({ resolveRealLand: () => null }));
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MunicipalLandFixtureSchema } from '../types/landFixture';

const slugs = ['munoz', 'ilagan', 'pototan', 'malaybalay'];
const fixtures = slugs.map((slug) => MunicipalLandFixtureSchema.parse(
  JSON.parse(readFileSync(`public/sample-data/${slug}.json`, 'utf8'))
));
let service: typeof import('../services/landSummary');

function localResponse(input: string | URL | Request): Response {
  const url = String(input);
  const index = slugs.findIndex((slug) => url === `/sample-data/${slug}.json`);
  if (index < 0) throw new Error('External network disabled');
  return new Response(JSON.stringify(fixtures[index]), { status: 200 });
}

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('fetch', vi.fn(localResponse));
  service = await import('../services/landSummary');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('municipal land service', () => {
  it.each(fixtures)('loads a sample for $location.name with external networking disabled', async ({ location }) => {
    const result = await service.fetchLandSummary(location.lat, location.lon);
    expect(result.sampleHub.id).toBe(location.id);
    expect(result.sampleHub.distanceKm).toBe(0);
    expect(result.isSample).toBe(true);
    expect(result.needsReview).toBe(true);
    expect(result.ndvi.trendAvailable).toBe(false);
    expect(result.rusleErosionRiskTonsHaYr).toBeGreaterThanOrEqual(0);
    expect(Object.values(result.provenance).every((entry) => entry.isSample && entry.isSynthetic)).toBe(true);
    expect(result.provenance['ndvi.trend']).toMatchObject({ isSample: true, isSynthetic: true, needsReview: true });
  });

  it('uses the nearest municipal proxy for custom coordinates with networking restricted to local fixtures', async () => {
    const result = await service.fetchLandSummary(8.2, 125.2);
    expect(result.sampleHub.id).toBe('bukidnon');
    expect(result.sampleHub.distanceKm).toBeGreaterThan(0);
    expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url)).sort()).toEqual(
      slugs.map(slug => `/sample-data/${slug}.json`).sort());
    expect(result.isSample).toBe(true);
  });

  it('chooses the nearest proxy and uses deterministic tie-breaking', () => {
    const first = fixtures[0];
    const a = { ...first, location: { ...first.location, id: 'a' } };
    const b = { ...first, location: { ...first.location, id: 'b' } };
    expect(service.buildSampleLandSummary(15.714, 120.906, [b, a]).sampleHub.id).toBe('a');
    expect(service.buildSampleLandSummary(15.714, 120.906, [a, b]).sampleHub.id).toBe('a');
    const result = service.buildSampleLandSummary(8.2, 125.2, fixtures);
    expect(result.sampleHub.id).toBe('bukidnon');
    expect(result.sampleHub.distanceKm).toBeGreaterThan(0);
  });

  it('shares local loads and returns independent summary arrays', async () => {
    const [a, b] = await Promise.all([
      service.fetchLandSummary(15.714, 120.906), service.fetchLandSummary(15.714, 120.906)
    ]);
    expect(fetch).toHaveBeenCalledTimes(4);
    a.ndvi.seasonalMean[0] = -1;
    expect(b.ndvi.seasonalMean[0]).toBe(fixtures[0].land.ndviMonthly[0]);
    await service.fetchLandSummary(8.156, 125.127);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('uses another valid hub when the closest fixture is corrupt or missing', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input).includes('malaybalay')) return new Response('{}');
      if (String(input).includes('ilagan')) return new Response('', { status: 404 });
      return localResponse(input);
    });
    const result = await service.fetchLandSummary(8.156, 125.127);
    expect(result.sampleHub.id).toBe('pototan');
    expect(result.isSample).toBe(true);
  });

  it('rejects invalid coordinates before requesting data', async () => {
    await expect(service.fetchLandSummary(91, 0)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
    expect(() => service.buildSampleLandSummary(0, 0, [])).toThrow('No valid');
  });

  it('skips a numerically unusable nearest profile', () => {
    const nearest = fixtures[0];
    const overflow = { ...nearest, land: { ...nearest.land, rusle: {
      ...nearest.land.rusle, R: Number.MAX_VALUE, K: Number.MAX_VALUE
    } } };
    const result = service.buildSampleLandSummary(nearest.location.lat, nearest.location.lon, [overflow, fixtures[1]]);
    expect(result.sampleHub.id).toBe('ilagan');
    expect(Number.isFinite(result.rusleErosionRiskTonsHaYr)).toBe(true);
  });

  it('retries after all local loads fail', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Local assets unavailable'));
    await expect(service.fetchLandSummary(0, 0)).rejects.toThrow('No valid');
    vi.mocked(fetch).mockImplementation(async (input) => localResponse(input));
    expect((await service.fetchLandSummary(8.156, 125.127)).sampleHub.id).toBe('bukidnon');
  });

  it('bounds requests even if a transport ignores cancellation', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
    const result = expect(service.fetchLandSummary(0, 0)).rejects.toThrow('No valid');
    await vi.advanceTimersByTimeAsync(5000);
    await result;
  });

  it('cancels one subscriber while another can still use the shared loads', async () => {
    const pending: Array<() => void> = [];
    vi.mocked(fetch).mockImplementation((input) => new Promise<Response>((resolve) => {
      pending.push(() => resolve(localResponse(input)));
    }));
    const controller = new AbortController();
    const canceled = service.fetchLandSummary(0, 0, controller.signal);
    const active = service.fetchLandSummary(8.156, 125.127);
    controller.abort();
    await expect(canceled).rejects.toMatchObject({ name: 'AbortError' });
    pending.forEach((resolve) => resolve());
    expect((await active).sampleHub.id).toBe('bukidnon');
  });
});
