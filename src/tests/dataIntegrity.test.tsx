import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchSoilGridsData, soilCacheKey, applyFarmerSoilOverride } from '../services/soilGrids';
import { CacheService, TELEMETRY_CACHE_TTL_MS } from '../services/cache';
import { buildClimateProvenance, buildSoilProvenance, hasProvisionalEvidence } from '../data/provenance';
import { useAppStore } from '../store/useAppStore';
import { SoilCard } from '../components/SoilCard';
import { RotationCard } from '../components/RotationCard';
import { ComparisonModal } from '../components/ComparisonModal';
import { PrintablePlan } from '../components/PrintablePlan';
import { MethodologyModal } from '../components/MethodologyModal';
import { App } from '../App';
import { getTranslation, translations } from '../i18n';
import type { ClimateData, SoilData } from '../types';

vi.mock('../store/useAppStore', async importOriginal => {
  const original = await importOriginal<typeof import('../store/useAppStore')>();
  return { useAppStore: Object.assign(() => original.useAppStore.getState(), original.useAppStore) };
});
vi.mock('../components/MapPicker', () => ({ MapPicker: () => null }));
const fixture = JSON.parse(readFileSync('public/sample-data/munoz.json', 'utf8')) as { climate: ClimateData; soil: SoilData };
const values = { clay: 420, sand: 220, silt: 360, phh2o: 53, soc: 120, bdod: 146 };
function payload(input: Partial<typeof values> = values) {
  return { properties: { layers: Object.entries(input).map(([name, mean]) => ({ name, depths: [{ label: '0-5cm', values: { mean } }, { label: '5-15cm', values: { mean } }] })) } };
}
function mockApi(data: unknown) {
  const fetch = vi.fn().mockImplementation(async (url: string) => url.startsWith('/sample-data/')
    ? { ok: true, json: async () => ({ location: { name: 'Science City of Muñoz' }, soil: fixture.soil }) }
    : { ok: true, json: async () => data });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
beforeEach(async () => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  await CacheService.clear();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('soil data integrity', () => {
  it.each([
    [15.714, 120.906, 'Muñoz'], [17.148, 121.89, 'Ilagan'],
    [10.952, 122.632, 'Pototan'], [8.156, 125.127, 'Malaybalay']
  ] as const)('keeps offline municipal examples explicitly labeled at %s, %s', async (lat, lon, name) => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const soil = await fetchSoilGridsData(lat, lon);
    expect(soil.isEstimate).toBe(true);
    expect(soil.source).toContain('FieldShift municipal soil example');
    expect(soil.provenance?.ph?.sampleLocation?.name).toContain(name);
    expect(soil.provenance?.ph?.isSample).toBe(true);
  });
  it.each([
    ['clay', 'rawClayPercent'], ['sand', 'rawSandPercent'], ['soc', 'rawSocDgPerKg'],
    ['bdod', 'bulkDensityGcm3'], ['phh2o', 'ph']
  ] as const)('preserves other readings when %s is absent', async (property, metric) => {
    const partial: Partial<typeof values> = { ...values };
    delete partial[property];
    mockApi(payload(partial));
    const soil = await fetchSoilGridsData(15.714, 120.906);
    expect(soil.isEstimate).toBe(false);
    expect(soil.source).toContain('model prediction');
    expect(soil[metric]).toBe(property === 'phh2o' ? null : undefined);
    expect(soil.provenance?.[metric]?.tier).toBe('unavailable');
    if (property !== 'phh2o') expect(soil.ph).toBe(5.3);
    if (property === 'clay' || property === 'sand') {
      expect(soil.texture).toBeNull();
      expect(soil.drainage).toBeNull();
    }
    if (property === 'soc') expect(soil.organicMatter).toBe('unknown');
    if (property === 'phh2o') expect(soil.phosphorusFixationRisk).toBeUndefined();
  });
  it('preserves valid zero clay/SOC while rejecting all-zero texture fractions', async () => {
    mockApi(payload({ ...values, clay: 0, sand: 700, silt: 300, soc: 0 }));
    const soil = await fetchSoilGridsData(15.714, 120.906);
    expect(soil.rawClayPercent).toBe(0);
    expect(soil.rawSocDgPerKg).toBe(0);
    expect(soil.texture).toBe('sandy_loam');
    expect(soil.provenance?.rawSocDgPerKg?.tier).toBe('live');
    mockApi(payload({ ...values, clay: 0, sand: 0, silt: 0 }));
    const zero = await fetchSoilGridsData(15.8, 120.9);
    expect(zero.texture).toBeNull();
    expect(zero.drainage).toBeNull();
  });
  it.each([-999, 150])('does not substitute pH 6.2 for invalid raw pH %s', async phh2o => {
    mockApi(payload({ ...values, phh2o }));
    const soil = await fetchSoilGridsData(15.714, 120.906);
    expect(soil.ph).toBeNull();
    expect(soil.phosphorusFixationRisk).toBeUndefined();
    expect(soil.rawClayPercent).toBe(42);
  });
  it('does not silently average away a missing depth prediction', async () => {
    const data = payload();
    const ph = data.properties.layers.find(layer => layer.name === 'phh2o')!;
    const raw: unknown = { ...data, properties: { layers: data.properties.layers.map(layer => layer === ph
      ? { ...ph, depths: [{ label: '0-5cm', values: { mean: 53 } }, { label: '5-15cm', values: { mean: null } }] } : layer) } };
    mockApi(raw);
    expect((await fetchSoilGridsData(15.714, 120.906)).ph).toBeNull();
  });
  it('does not label a lone or duplicate depth as a complete 0–15 cm profile', async () => {
    const data = payload();
    data.properties.layers.find(layer => layer.name === 'phh2o')!.depths.pop();
    data.properties.layers.find(layer => layer.name === 'bdod')!.depths[1].label = '0-5cm';
    mockApi(data);
    const soil = await fetchSoilGridsData(15.714, 120.906);
    expect(soil.ph).toBeNull();
    expect(soil.bulkDensityGcm3).toBeUndefined();
    expect(soil.rawSocDgPerKg).toBe(120);
  });
  it.each([{}, { properties: { layers: [] } }, payload({ clay: -999 })])('uses a labeled reference for unusable responses %j', async data => {
    mockApi(data);
    const save = vi.spyOn(CacheService, 'set');
    const soil = await fetchSoilGridsData(15.714, 120.906);
    expect(soil.isEstimate).toBe(true);
    expect(soil.source).toContain('FieldShift municipal soil example');
    expect(soil.provenance?.ph?.isSample).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });
  it('ignores legacy poisoned cache entries and caches valid responses for seven days', async () => {
    await CacheService.set('soilgrids_15.714_120.906', { ...fixture.soil, ph: 6.2, rawClayPercent: 0, rawSandPercent: 0, rawSocDgPerKg: 0 });
    const fetch = mockApi(payload());
    const save = vi.spyOn(CacheService, 'set');
    const first = await fetchSoilGridsData(15.714, 120.906);
    const cached = await fetchSoilGridsData(15.714, 120.906);
    expect(first.ph).toBe(5.3);
    expect(cached.ph).toBe(5.3);
    expect(cached.provenance?.ph?.tier).toBe('cached-live');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(soilCacheKey(15.714, 120.906), expect.objectContaining({ schemaVersion: 2 }), TELEMETRY_CACHE_TTL_MS);
  });
  it('rejects malformed versioned cache values', async () => {
    await CacheService.set(soilCacheKey(15.714, 120.906), { schemaVersion: 2, profile: { ...fixture.soil, ph: 100 } });
    const fetch = mockApi(payload());
    expect((await fetchSoilGridsData(15.714, 120.906)).ph).toBe(5.3);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([
    { depths: 'unavailable' },
    { depths: [{ label: '0-5cm', values: { mean: 'bad' } }] },
    { depths: [{ label: '0-5cm', values: null }] }
  ])('preserves valid model readings when a single property is malformed: %j', async invalid => {
    const data = payload();
    const broken: unknown = { properties: { layers: data.properties.layers.map(layer => layer.name === 'soc'
      ? { ...layer, ...invalid } : layer) } };
    mockApi(broken);
    const soil = await fetchSoilGridsData(15.714, 120.906);
    expect(soil.isEstimate).toBe(false);
    expect(soil.ph).toBe(5.3);
    expect(soil.rawClayPercent).toBe(42);
    expect(soil.rawSocDgPerKg).toBeUndefined();
  });
  it('keeps zero pH/density at one depth unavailable rather than averaging them into positive readings', async () => {
    const data = payload();
    data.properties.layers.find(layer => layer.name === 'phh2o')!.depths[0].values.mean = 0;
    data.properties.layers.find(layer => layer.name === 'bdod')!.depths[0].values.mean = 0;
    mockApi(data);
    const soil = await fetchSoilGridsData(15.714, 120.906);
    expect(soil.isEstimate).toBe(false);
    expect(soil.ph).toBeNull();
    expect(soil.bulkDensityGcm3).toBeUndefined();
    expect(soil.rawClayPercent).toBe(42);
  });
  it('does not discard valid properties when a tiny positive value rounds to zero', async () => {
    mockApi(payload({ ...values, phh2o: 0.01, bdod: 0.01 }));
    const soil = await fetchSoilGridsData(15.714, 120.906);
    expect(soil.isEstimate).toBe(false);
    expect(soil.ph).toBeNull();
    expect(soil.bulkDensityGcm3).toBeUndefined();
    expect(soil.rawSocDgPerKg).toBe(120);
  });
  it('rejects a versioned cache profile with no usable source readings', async () => {
    await CacheService.set(soilCacheKey(15.714, 120.906), {
      schemaVersion: 2, profile: { source: 'empty', isEstimate: false,
        ph: null, texture: null, drainage: null, organicMatter: 'unknown' }
    });
    const fetch = mockApi(payload());
    expect((await fetchSoilGridsData(15.714, 120.906)).ph).toBe(5.3);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('rejects invalid coordinates before accessing data', async () => {
    const fetch = mockApi(payload());
    await expect(fetchSoilGridsData(Number.NaN, 120.906)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('bounds both the API and local fixture requests and clears timers', async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      const signal = options.signal!;
      signals.push(signal);
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    })));
    const pending = fetchSoilGridsData(15.714, 120.906);
    await vi.advanceTimersByTimeAsync(10001);
    const soil = await pending;
    expect(soil.isEstimate).toBe(true);
    expect(signals).toHaveLength(2);
    expect(signals.every(signal => signal.aborted)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('incomplete and provisional plan presentation', () => {
  it('ignores undefined override fields and rejects invalid overrides without changing state', () => {
    useAppStore.setState({ climateData: fixture.climate, soilData: fixture.soil });
    useAppStore.getState().computeRecommendations();
    const before = useAppStore.getState().recommendedPlans;
    expect(applyFarmerSoilOverride(fixture.soil, { texture: undefined }).texture).toBe(fixture.soil.texture);
    useAppStore.getState().setSoilOverride({ ph: Number.NaN });
    expect(useAppStore.getState().soilOverride).toBeNull();
    expect(useAppStore.getState().recommendedPlans).toEqual(before);
    expect(applyFarmerSoilOverride(fixture.soil, { source: 'Unverified identity', isEstimate: false, provenance: {} })).toBe(fixture.soil);
  });
  it('does not call a cleared texture or unknown organic matter an available farmer reading', () => {
    const cleared = applyFarmerSoilOverride(fixture.soil, { texture: null, organicMatter: 'unknown' });
    expect(cleared.provenance?.texture?.tier).toBe('unavailable');
    expect(cleared.provenance?.organicMatter?.tier).toBe('unavailable');
  });
  it.each(['en', 'fil'] as const)('offers a labeled pH recovery field and displays effective numerical overrides in %s', language => {
    useAppStore.setState({ language, soilData: { ...fixture.soil, ph: null },
      soilOverride: { rawClayPercent: 12, rawSandPercent: 22, rawSocDgPerKg: 200 } });
    const html = renderToStaticMarkup(createElement(SoilCard));
    expect(html).toContain('name="fieldPh"');
    const input = html.match(/<input[^>]*name="fieldPh"[^>]*>/)?.[0];
    expect(input).toContain('required=""');
    expect(input).not.toContain('value="');
    expect(html).toContain(getTranslation(language, 'dataQuality.fieldPh'));
    expect(html).toContain(getTranslation(language, 'dataQuality.applyPh'));
    expect(html).toContain(getTranslation(language, 'dataQuality.phHint'));
    expect(html).toContain('12% / 22%');
    expect(html).toContain('2.00%');
  });
  it.each(['en', 'fil'] as const)('distinguishes loading from missing telemetry and disables empty printing in %s', language => {
    useAppStore.setState({ language, currentStep: 4, isLoadingTelemetry: true });
    const loading = renderToStaticMarkup(createElement(App));
    expect(loading).toContain(getTranslation(language, 'dataQuality.loading'));
    expect(loading).not.toContain(getTranslation(language, 'results.noPlans'));
    useAppStore.setState({ isLoadingTelemetry: false, climateData: fixture.climate });
    const missing = renderToStaticMarkup(createElement(App));
    expect(missing).toContain(getTranslation(language, 'dataQuality.missingTelemetry'));
    const disabled = missing.match(/<button[^>]*disabled=""[^>]*>/g) ?? [];
    expect(disabled.filter(button => button.includes(getTranslation(language, 'dataQuality.noPrintablePlan')))).toHaveLength(2);
  });
  it('clears stale plans/comparisons and restores ranking only after required values are supplied', () => {
    useAppStore.setState({ climateData: fixture.climate, soilData: fixture.soil });
    useAppStore.getState().computeRecommendations();
    const previous = useAppStore.getState().recommendedPlans;
    expect(previous.length).toBeGreaterThan(0);
    useAppStore.setState({ comparedPlanIds: [previous[0].id], soilData: { ...fixture.soil, ph: null } });
    useAppStore.getState().computeRecommendations();
    expect(useAppStore.getState().recommendedPlans).toEqual([]);
    expect(useAppStore.getState().comparedPlanIds).toEqual([]);
    expect(useAppStore.getState().advisoryIssuedAt).toBeNull();
    useAppStore.getState().setSoilOverride({ ph: 6.3 });
    expect(useAppStore.getState().recommendedPlans.map(plan => plan.scores)).toEqual(previous.map(plan => plan.scores));
    useAppStore.getState().resetSoilOverride();
    expect(useAppStore.getState().recommendedPlans).toEqual([]);
    expect(applyFarmerSoilOverride({ ...fixture.soil, ph: null }, { texture: 'sandy' }).phosphorusFixationRisk).toBeUndefined();
    const cleared = applyFarmerSoilOverride({ ...fixture.soil, ph: 5, phosphorusFixationRisk: 'high' }, { ph: null });
    expect(cleared.ph).toBeNull();
    expect(cleared.phosphorusFixationRisk).toBeUndefined();
    expect(cleared.provenance?.phosphorusFixationRisk?.tier).toBe('unavailable');
  });
  it.each(['en', 'fil'] as const)('shows unavailable readings and provisional notices in %s', async language => {
    mockApi(payload({ soc: 0 }));
    const soil = await fetchSoilGridsData(15.714, 120.906);
    useAppStore.setState({ language, soilData: soil });
    const html = renderToStaticMarkup(createElement(SoilCard));
    expect(html).toContain(getTranslation(language, 'provenance.unavailableValue'));
    expect(html).toContain(getTranslation(language, 'dataQuality.missingSoil'));
    expect(html).not.toContain('6.2 pH');
    expect(html).toContain('0.00%');
    useAppStore.setState({ climateData: fixture.climate, soilData: fixture.soil, isComparisonModalOpen: true, isMethodologyModalOpen: true });
    useAppStore.getState().computeRecommendations();
    const plan = { ...useAppStore.getState().recommendedPlans[0], robustness: 'robust' as const };
    useAppStore.setState({ recommendedPlans: [plan], comparedPlanIds: [plan.id] });
    for (const component of [createElement(RotationCard, { plan, rank: 1 }), createElement(ComparisonModal), createElement(PrintablePlan)]) {
      const content = renderToStaticMarkup(component);
      expect(content).toContain(getTranslation(language, 'dataQuality.provisionalDetail'));
      expect(content).not.toContain(getTranslation(language, 'results.robustBadge'));
    }
    const methodology = renderToStaticMarkup(createElement(MethodologyModal));
    expect(methodology).toContain(getTranslation(language, 'dataQuality.scenarioInterpretation'));
    expect(methodology).not.toContain('certified as');
  });
  it('keeps the new translation keys aligned', () => {
    expect(Object.keys(translations.en.dataQuality).sort()).toEqual(Object.keys(translations.fil.dataQuality).sort());
    expect(hasProvisionalEvidence({ climate: null, soil: null, land: null })).toBe(true);
    expect(hasProvisionalEvidence({ climate: { ...fixture.climate, provenance: buildClimateProvenance(fixture.climate, 'sample') },
      soil: { ...fixture.soil, provenance: buildSoilProvenance(fixture.soil, false) }, land: null })).toBe(true);
  });
});
