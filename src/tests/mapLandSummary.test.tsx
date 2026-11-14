import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapPicker } from '../components/MapPicker';
import { PrintablePlan } from '../components/PrintablePlan';
import { useAppStore } from '../store/useAppStore';
import { buildSampleLandSummary } from '../services/landSummary';
import { MunicipalLandFixtureSchema } from '../types/landFixture';
import { getTranslation } from '../i18n';
import english from '../i18n/en.json';
import filipino from '../i18n/fil.json';
import type { ClimateData, SoilData } from '../types';

vi.mock('leaflet', () => ({ default: {} }));
vi.mock('../store/useAppStore', async (importOriginal) => {
  const original = await importOriginal<typeof import('../store/useAppStore')>();
  // SSR reads the active test snapshot; client subscriptions remain covered by store-entry tests.
  return { useAppStore: Object.assign(() => original.useAppStore.getState(), original.useAppStore) };
});

const fixture = MunicipalLandFixtureSchema.parse(JSON.parse(readFileSync('public/sample-data/munoz.json', 'utf8')));
const initial = useAppStore.getInitialState();
beforeEach(() => { useAppStore.setState(initial, true); });
afterEach(() => { vi.useRealTimers(); });

function leaves(value: unknown, prefix = ''): Record<string, string> {
  if (typeof value === 'string') return { [prefix]: value };
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value).flatMap(([key, child]) =>
    Object.entries(leaves(child, prefix ? `${prefix}.${key}` : key))));
}

describe('land summary presentation', () => {
  it('prints the advisory generation date even when the print view mounts later', () => {
    vi.useFakeTimers();
    const generated = Date.parse('2026-11-15T12:00:01Z');
    vi.setSystemTime(generated);
    const municipal = JSON.parse(readFileSync('public/sample-data/munoz.json', 'utf8')) as { climate: ClimateData; soil: SoilData };
    useAppStore.setState({ climateData: municipal.climate, soilData: municipal.soil });
    useAppStore.getState().computeRecommendations();
    const date = new Date(generated).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
    vi.setSystemTime(generated + 2 * 86400000);
    const html = renderToStaticMarkup(createElement(PrintablePlan));
    expect(html).toContain(date);
    expect(useAppStore.getState().advisoryIssuedAt).toBe(generated);
  });

  it('prints unavailable elevation when no land profile exists', () => {
    const municipal = JSON.parse(readFileSync('public/sample-data/munoz.json', 'utf8')) as { climate: ClimateData; soil: SoilData };
    useAppStore.setState({ climateData: municipal.climate, soilData: municipal.soil,
      selectedLocation: { ...initial.selectedLocation, elevationMeters: 35 }, landSummary: null });
    useAppStore.getState().computeRecommendations();
    const html = renderToStaticMarkup(createElement(PrintablePlan));
    expect(html).toContain(getTranslation('en', 'land.unknownElevation'));
    expect(html).not.toContain('Elev: ~35m');
  });

  it.each(['en', 'fil'] as const)('renders sample metadata and unavailable annual trend in %s', (language) => {
    useAppStore.setState({ language, landSummary: buildSampleLandSummary(15.714, 120.906, [fixture]) });
    const html = renderToStaticMarkup(createElement(MapPicker));
    expect(html).toContain(getTranslation(language, 'land.syntheticNotice'));
    expect(html).toContain(getTranslation(language, 'land.insufficientTrendData'));
    expect(html.split(getTranslation(language, 'land.unknownResolution'))).toHaveLength(8);
    expect(html.split(getTranslation(language, 'land.unknownPeriod'))).toHaveLength(8);
    expect(html).toContain('name="lat"');
    expect(html).toContain('name="lon"');
    expect(html).toContain('<fieldset>');
    expect(html).toContain('aria-pressed="true"');
  });

  it('exposes loading, errors, and retry controls using accessible markup', () => {
    useAppStore.setState({ isLoadingLand: true });
    const loading = renderToStaticMarkup(createElement(MapPicker));
    expect(loading).toContain('aria-busy="true"');
    expect(loading).toContain(getTranslation('en', 'land.loading'));
    useAppStore.setState({ isLoadingLand: false, landError: 'land.unavailable' });
    const failure = renderToStaticMarkup(createElement(MapPicker));
    expect(failure).toContain('role="alert"');
    expect(failure).toContain(getTranslation('en', 'land.retry'));
    expect(failure).not.toContain('Synthetic municipal examples');
  });

  it('keeps recursive translation keys and parameter placeholders aligned', () => {
    const en = leaves(english);
    const fil = leaves(filipino);
    expect(Object.keys(en).sort()).toEqual(Object.keys(fil).sort());
    for (const key of Object.keys(en)) {
      expect(en[key].match(/\{\w+\}/g) ?? [], key).toEqual(fil[key].match(/\{\w+\}/g) ?? []);
    }
  });
});
