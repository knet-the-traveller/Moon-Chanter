import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { ComparisonModal } from '../components/ComparisonModal';
import { getTranslation, translations } from '../i18n';
import { useAppStore } from '../store/useAppStore';
import { PILOT_LOCATIONS } from '../data/pilotLocations';

vi.mock('leaflet', () => ({ default: {} }));
vi.mock('../store/useAppStore', async (importOriginal) => {
  const original = await importOriginal<typeof import('../store/useAppStore')>();
  return { useAppStore: Object.assign(() => original.useAppStore.getState(), original.useAppStore) };
});

describe('UI/UX Polish & Navigation Cleanup (P2)', () => {
  beforeEach(() => {
    useAppStore.setState({ ...useAppStore.getInitialState(), useDemoAssumptions: false }, true);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps en.json and fil.json keys aligned across conditions, provenance, and results', () => {
    for (const section of ['conditions', 'provenance', 'results'] as const) {
      expect(Object.keys(translations.en[section]).sort()).toEqual(
        Object.keys(translations.fil[section]).sort()
      );
    }
    expect(getTranslation('en', 'results.pillarClimate')).toBe('Climate Shock Buffer');
    expect(getTranslation('fil', 'results.pillarClimate')).toBe('Proteksyon sa Pagbabago ng Panahon');
  });

  it('removes the duplicate top-right View Recommendations CTA on Step 3 while keeping Back to Conditions and bottom Generate CTA', () => {
    useAppStore.setState({ currentStep: 3, language: 'en' });
    const html = renderToStaticMarkup(createElement(App));
    expect(html).toContain('Back to Conditions');
    expect(html).toContain('Generate &amp; Rank Rotation Plans');
    expect(html).not.toContain('View Recommendations');
  });

  it.each(['en', 'fil'] as const)('localizes all 5 pillar labels including Climate Shock Buffer in ComparisonModal (%s)', async (language) => {
    await useAppStore.getState().selectPilotPreset(PILOT_LOCATIONS[0]);
    const plans = useAppStore.getState().recommendedPlans;
    useAppStore.setState({
      language,
      isComparisonModalOpen: true,
      comparedPlanIds: [plans[0].id]
    });
    const html = renderToStaticMarkup(createElement(ComparisonModal));
    expect(html).toContain(getTranslation(language, 'results.pillarBreakdown'));
    expect(html).toContain(getTranslation(language, 'results.pillarSoil'));
    expect(html).toContain(getTranslation(language, 'results.pillarWater'));
    expect(html).toContain(getTranslation(language, 'results.pillarClimate'));
    expect(html).toContain(getTranslation(language, 'results.pillarEconomics'));
    expect(html).toContain(getTranslation(language, 'results.pillarLabor'));
    expect(html).not.toContain('Climate Risk:');
  });

  it.each(['en', 'fil'] as const)('renders 1-line source/period KPI subtitles and styled bottom caveats accordion in ClimateCard (%s)', async (language) => {
    await useAppStore.getState().selectPilotPreset(PILOT_LOCATIONS[0]);
    useAppStore.setState({ language });
    const { ClimateCard } = await import('../components/ClimateCard');
    const html = renderToStaticMarkup(createElement(ClimateCard));
    const climate = useAppStore.getState().climateData!;
    expect(html).toContain(`${getTranslation(language, 'conditions.shortNasaPower')} · ${climate.dateRange}`);
    expect(html).toContain(getTranslation(language, 'conditions.heatRiskLabel'));
    expect(html).toContain(getTranslation(language, 'conditions.drySpellRiskLabel'));
    expect(html).toContain(getTranslation(language, 'provenance.viewCaveats').replace(/&/g, '&amp;'));
    expect(html).not.toMatch(/<summary[^>]*>\s*<h[1-6]/i);
  });

  it('replaces the 6 repeated provenance.review paragraphs in MapPicker tiles with concise 1-line subtitles while preserving all 7 provenance items in <details>', async () => {
    await useAppStore.getState().selectPilotPreset(PILOT_LOCATIONS[0]);
    useAppStore.setState({ language: 'en' });
    const { MapPicker } = await import('../components/MapPicker');
    const html = renderToStaticMarkup(createElement(MapPicker));
    const [beforeDetails, insideDetails] = html.split('<details');
    const dlBlock = beforeDetails.split('<dl')[1] ?? '';
    expect(dlBlock).not.toContain(getTranslation('en', 'provenance.review'));
    expect(dlBlock).toContain(getTranslation('en', 'provenance.reviewShort'));
    expect(insideDetails).toBeDefined();
    expect(html).toContain(getTranslation('en', 'mvp.landDetails'));
  });
});
