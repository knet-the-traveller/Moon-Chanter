import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { ComparisonModal } from '../components/ComparisonModal';
import { getTranslation, translations } from '../i18n';
import { useAppStore } from '../store/useAppStore';
import { PILOT_LOCATIONS } from '../data/pilotLocations';
import { buildSampleLandSummary } from '../services/landSummary';
import { MunicipalLandFixtureSchema } from '../types/landFixture';

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

  it('keeps en.json and fil.json keys aligned across conditions, provenance, priorities, and results', () => {
    for (const section of ['conditions', 'provenance', 'priorities', 'results'] as const) {
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

    useAppStore.setState({
      climateData: { ...climate, isSampleData: true, dateRange: '' }
    });
    const sampleEmptyDateHtml = renderToStaticMarkup(createElement(ClimateCard));
    const shortSample = getTranslation(language, 'conditions.shortSampleClimate');
    expect(sampleEmptyDateHtml).toContain(shortSample);
    expect(sampleEmptyDateHtml).not.toContain(`${shortSample} · <`);
  });

  it('replaces repeated MapPicker tile caveats with non-duplicated 1-line subtitles across pilot and sample points while keeping 7 provenance items in <details>', async () => {
    await useAppStore.getState().selectPilotPreset(PILOT_LOCATIONS[0]);
    useAppStore.setState({ language: 'en' });
    const { MapPicker } = await import('../components/MapPicker');
    const reviewShort = getTranslation('en', 'provenance.reviewShort');

    const pilotHtml = renderToStaticMarkup(createElement(MapPicker));
    const [beforePilotDetails, insidePilotDetails] = pilotHtml.split('<details');
    const pilotDlBlock = beforePilotDetails.split('<dl')[1] ?? '';
    expect(pilotDlBlock).not.toContain(getTranslation('en', 'provenance.review'));
    expect(pilotDlBlock).toContain(reviewShort);
    expect(pilotDlBlock).not.toContain(`${reviewShort} · ${reviewShort}`);
    expect(insidePilotDetails).toBeDefined();
    expect(insidePilotDetails.match(/<li>/g)).toHaveLength(7);
    expect(pilotHtml).toContain(getTranslation('en', 'mvp.landDetails'));

    const fixture = MunicipalLandFixtureSchema.parse(JSON.parse(readFileSync('public/sample-data/munoz.json', 'utf8')));
    useAppStore.setState({
      landSummary: buildSampleLandSummary(14.5, 121.0, [fixture])
    });
    const sampleHtml = renderToStaticMarkup(createElement(MapPicker));
    const [beforeSampleDetails, insideSampleDetails] = sampleHtml.split('<details');
    const sampleDlBlock = beforeSampleDetails.split('<dl')[1] ?? '';
    expect(sampleDlBlock).toContain(reviewShort);
    expect(sampleDlBlock).not.toContain(`${reviewShort} · ${reviewShort}`);
    expect(insideSampleDetails.match(/<li>/g)).toHaveLength(7);
  });

  it('maps SoilCard header badge accurately across bundled, cached, live, partial, municipal, unavailable, and farmer override states', async () => {
    const { SoilCard } = await import('../components/SoilCard');
    const { buildSoilProvenance, cachedProvenance } = await import('../data/provenance');
    await useAppStore.getState().selectPilotPreset(PILOT_LOCATIONS[0]);
    const bundledSoil = useAppStore.getState().soilData!;
    expect(renderToStaticMarkup(createElement(SoilCard))).toContain(
      getTranslation('en', 'provenance.soilOriginBundled')
    );

    const liveProvenance = buildSoilProvenance(bundledSoil, true);
    useAppStore.setState({
      soilData: {
        ...bundledSoil,
        modelEvidence: undefined,
        provenance: cachedProvenance(liveProvenance)
      },
      isMunicipalBaselineActive: false
    });
    expect(renderToStaticMarkup(createElement(SoilCard))).toContain(
      getTranslation('en', 'provenance.soilOriginCached')
    );

    useAppStore.setState({
      soilData: {
        ...bundledSoil,
        modelEvidence: undefined,
        provenance: liveProvenance
      },
      isMunicipalBaselineActive: false
    });
    expect(renderToStaticMarkup(createElement(SoilCard))).toContain(
      getTranslation('en', 'provenance.soilOriginLive')
    );

    // Partial SoilGrids response missing pH must still classify as live/cached, never soilAutomated
    const partialSoil = {
      ...bundledSoil,
      ph: null,
      modelEvidence: undefined,
      isEstimate: false
    };
    const partialLiveProv = buildSoilProvenance(partialSoil, true);
    useAppStore.setState({
      soilData: { ...partialSoil, provenance: partialLiveProv },
      isMunicipalBaselineActive: false
    });
    expect(renderToStaticMarkup(createElement(SoilCard))).toContain(
      getTranslation('en', 'provenance.soilOriginLive')
    );
    useAppStore.setState({
      soilData: { ...partialSoil, provenance: cachedProvenance(partialLiveProv) },
      isMunicipalBaselineActive: false
    });
    expect(renderToStaticMarkup(createElement(SoilCard))).toContain(
      getTranslation('en', 'provenance.soilOriginCached')
    );

    // Cached municipal sample estimate with isMunicipalBaselineActive=false must never claim SoilGrids 250 m Cached Grid
    const sampleSoil = { ...bundledSoil, modelEvidence: undefined, isEstimate: true };
    const cachedSampleProv = cachedProvenance(buildSoilProvenance(sampleSoil, false));
    useAppStore.setState({
      soilData: { ...sampleSoil, provenance: cachedSampleProv },
      isMunicipalBaselineActive: false
    });
    const sampleHtml = renderToStaticMarkup(createElement(SoilCard));
    expect(sampleHtml).toContain(getTranslation('en', 'provenance.soilOriginMunicipal'));
    expect(sampleHtml).not.toContain(getTranslation('en', 'provenance.soilOriginCached'));

    // Unavailable soil profile without required inputs or baseline
    useAppStore.setState({
      soilData: {
        source: 'ISRIC SoilGrids unavailable',
        texture: null,
        drainage: null,
        organicMatter: 'unknown',
        ph: null,
        isEstimate: false
      },
      isMunicipalBaselineActive: false
    });
    expect(renderToStaticMarkup(createElement(SoilCard))).toContain(
      getTranslation('en', 'provenance.soilOriginUnavailable')
    );

    useAppStore.getState().setSoilOverride({ drainage: 'poor' });
    const overriddenHtml = renderToStaticMarkup(createElement(SoilCard));
    expect(overriddenHtml).toContain(getTranslation('en', 'provenance.soilOriginOverride'));
    expect(overriddenHtml).toContain(getTranslation('en', 'provenance.farmer'));
  });

  it('places relocation advisory above KPIs and Farmer Soil Override controls above the collapsed caveats drawer in SoilCard DOM order', async () => {
    const { SoilCard } = await import('../components/SoilCard');
    const { resolveBundledSoil } = await import('../services/bundledSoilGrids');
    const relocatedSoil = resolveBundledSoil(15.714, 120.906)!;
    useAppStore.setState({ soilData: relocatedSoil, language: 'en', soilOverride: null });
    const html = renderToStaticMarkup(createElement(SoilCard));
    const advisoryText = getTranslation('en', 'soilModel.locationAdvisory');
    const advisoryIndex = html.indexOf(advisoryText);
    const kpiIndex = html.indexOf(getTranslation('en', 'conditions.soilTexture'));
    const overrideIndex = html.indexOf(getTranslation('en', 'conditions.overridePrompt'));
    const caveatsIndex = html.indexOf(getTranslation('en', 'provenance.viewCaveats').replace(/&/g, '&amp;'));
    const modelDetailsIndex = html.indexOf(getTranslation('en', 'soilModel.title'));
    expect(html.split(advisoryText)).toHaveLength(2);
    expect(advisoryIndex).toBeGreaterThan(-1);
    expect(kpiIndex).toBeGreaterThan(advisoryIndex);
    expect(overrideIndex).toBeGreaterThan(kpiIndex);
    expect(caveatsIndex).toBeGreaterThan(overrideIndex);
    expect(modelDetailsIndex).toBeGreaterThan(overrideIndex);
  });

  it('renders MapPicker Expand Map toggle, LandSummary KPI tiles & details, and Step 2 WaterSourceCard and FieldNotesCard', async () => {
    // 1. MapPicker Expand Map toggle and LandSummary tiles/details
    await useAppStore.getState().selectPilotPreset(PILOT_LOCATIONS[0]);
    useAppStore.setState({ language: 'en', isMapExpanded: false });
    const { MapPicker } = await import('../components/MapPicker');
    const mapHtml = renderToStaticMarkup(createElement(MapPicker));
    expect(mapHtml).toContain(getTranslation('en', 'map.expandMap'));

    const [beforeDetails, insideDetails] = mapHtml.split('<details');
    const dlBlock = beforeDetails.split('<dl')[1] ?? '';
    expect(dlBlock).toContain(getTranslation('en', 'land.elevation'));
    expect(dlBlock).toContain(getTranslation('en', 'land.slope'));
    expect(dlBlock).toContain(getTranslation('en', 'land.flood'));
    expect(dlBlock).toContain(getTranslation('en', 'land.bareMonths'));
    expect(dlBlock).toContain(getTranslation('en', 'mvp.erosionTitle'));
    expect(dlBlock).toContain(getTranslation('en', 'land.monthlyNdvi'));
    expect(insideDetails).toBeDefined();
    expect(insideDetails.match(/<li>/g)).toHaveLength(7);

    // Expand Map toggle state
    useAppStore.setState({ isMapExpanded: true });
    const expandedMapHtml = renderToStaticMarkup(createElement(MapPicker));
    expect(expandedMapHtml).toContain(getTranslation('en', 'map.minimizeMap'));

    // Localized NDVI legend strings parity
    expect(getTranslation('en', 'map.ndviLowFallow')).toBe('Low / Fallow');
    expect(getTranslation('fil', 'map.ndviLowFallow')).toBe('Mababa / Tiwangwang');
    expect(getTranslation('en', 'map.ndviModerate')).toBe('Moderate');
    expect(getTranslation('fil', 'map.ndviModerate')).toBe('Katamtaman');
    expect(getTranslation('en', 'map.ndviHighVigor')).toBe('High Vigor');
    expect(getTranslation('fil', 'map.ndviHighVigor')).toBe('Malagong Halaman');

    // 2. Step 2 WaterSourceCard and FieldNotesCard
    useAppStore.setState({
      currentStep: 2,
      language: 'en',
      waterSource: 'irrigation_canal',
      fieldSizeHa: 2.5,
      plotNotes: 'Parcel near canal gate'
    });
    const appHtml = renderToStaticMarkup(createElement(App));

    // WaterSourceCard assertions
    expect(appHtml).toContain(getTranslation('en', 'conditions.waterSourceTitle'));
    expect(appHtml).toContain(getTranslation('en', 'conditions.waterCanal'));
    expect(appHtml).toContain(getTranslation('en', 'conditions.waterRainfed'));
    expect(appHtml).toContain(getTranslation('en', 'conditions.waterPumpWell'));
    expect(appHtml).toContain(getTranslation('en', 'conditions.waterSmallPond'));
    expect(appHtml).toContain(getTranslation('en', 'conditions.waterNeedsReview'));
    expect(appHtml).toContain(getTranslation('en', 'conditions.waterAccessHint'));

    // FieldNotesCard assertions
    expect(appHtml).toContain(getTranslation('en', 'conditions.fieldNotesTitle').replace(/&/g, '&amp;'));
    expect(appHtml).toContain('name="fieldSizeHa"');
    expect(appHtml).toContain('value="2.5"');
    expect(appHtml).toContain('Parcel near canal gate');
  });

  it('renders Step 3 6 color-coded priority sliders, paginated 13-crop selector with traits and risk, and < 2 crops warning', async () => {
    useAppStore.setState({ currentStep: 3, language: 'en', excludedCropIds: [] });
    const { PrioritiesSection } = await import('../components/PrioritiesSection');
    const appHtml = renderToStaticMarkup(createElement(App));

    // 1. Step 3 Sliders, Back to Conditions, and Generate CTAs (zero View Recommendations)
    expect(appHtml).toContain('Back to Conditions');
    expect(appHtml).toContain('Generate &amp; Rank Rotation Plans');
    expect(appHtml).not.toContain('View Recommendations');
    expect(appHtml).toContain('Climate Shock Buffer');
    expect(appHtml).toContain('Soil Health');
    expect(appHtml).toContain('Water Resilience');
    expect(appHtml).toContain('Stable Income');
    expect(appHtml).toContain('Low Input');
    expect(appHtml).toContain('Low Labor');

    // 2. Paginated crop list default (Page 1: Showing 1–5 of 13 crops)
    const sectionHtml = renderToStaticMarkup(createElement(PrioritiesSection));
    expect(sectionHtml).toContain('Showing 1–5 of 13 crops');
    expect(sectionHtml).toContain('Lowland Rice');
    expect(sectionHtml).toContain('Steady Income');
    expect(sectionHtml).toContain('Rich Soil');
    expect(sectionHtml).toContain('Saves Water');
    expect(sectionHtml).toMatch(/Low Risk|Med Risk/);

    // Page 2 / Show All renders Sunn Hemp / Green Manure
    const allCropsHtml = renderToStaticMarkup(createElement(PrioritiesSection, { initialShowAll: true }));
    expect(allCropsHtml).toContain('Sunn Hemp / Green Manure');

    // 3. Low-crop inline warning when < 2 crops remain enabled
    const all13CropIds = [
      'rice', 'corn', 'mungbean', 'peanut', 'cowpea',
      'soybean', 'cover_crotalaria', 'sweet_potato', 'cassava',
      'eggplant', 'tomato', 'ampalaya', 'onion'
    ];
    // Exclude 12 of the 13 crops
    useAppStore.setState({ excludedCropIds: all13CropIds.slice(1) });
    const warningHtml = renderToStaticMarkup(createElement(PrioritiesSection));
    expect(warningHtml).toContain('role="alert"');
    expect(warningHtml).toContain(getTranslation('en', 'priorities.lowCropWarning'));
  });

  it('renders Step 4 Spotlight plan with 5 fit bars and Other Good Crop Plans with pinned baseline plan above the fold', async () => {
    await useAppStore.getState().selectPilotPreset(PILOT_LOCATIONS[0]);
    useAppStore.getState().setSoilOverride({ texture: 'loam', drainage: 'well' });
    useAppStore.setState({ currentStep: 4, language: 'en' });
    const plans = useAppStore.getState().recommendedPlans;
    expect(plans.length).toBe(6);
    const baselinePlan = plans.find(p => p.isBaseline);
    expect(baselinePlan).toBeDefined();

    const appHtml = renderToStaticMarkup(createElement(App));

    // 1. Spotlight plan defaults to recommendedPlans[0]
    expect(appHtml).toContain(plans[0].name.en);
    // 5 fit bars
    expect(appHtml).toContain('Soil Health');
    expect(appHtml).toContain('Water Resilience');
    expect(appHtml).toContain('Climate Shock Buffer');
    expect(appHtml).toContain('Economics');
    expect(appHtml).toMatch(/Labor Feasibility|Labor/);

    // 2. Other Good Crop Plans section
    expect(appHtml).toContain(getTranslation('en', 'results.otherGoodPlans'));
    // #2 and #3 visible
    expect(appHtml).toContain(plans[1].name.en);
    expect(appHtml).toContain(plans[2].name.en);
    // Pinned baseline plan visible immediately without clicking show more
    expect(appHtml).toContain(baselinePlan!.name.en);
    expect(appHtml).toContain(getTranslation('en', 'results.showMorePlans'));
  });

  it('promotes an alternative plan to active spotlight and updates PrintablePlan with promoted rank, waterSource, fieldSizeHa, and plotNotes', async () => {
    await useAppStore.getState().selectPilotPreset(PILOT_LOCATIONS[0]);
    const plans = useAppStore.getState().recommendedPlans;
    expect(plans.length).toBeGreaterThan(1);
    const planToPromote = plans[1];

    useAppStore.setState({
      currentStep: 4,
      language: 'en',
      waterSource: 'pump_well',
      fieldSizeHa: 3.2,
      plotNotes: 'Lower terrace near creek'
    });

    // Promote plan #2
    useAppStore.getState().promotePlan(planToPromote.id);
    expect(useAppStore.getState().activeSpotlightPlanId).toBe(planToPromote.id);

    const appHtml = renderToStaticMarkup(createElement(App));
    // Spotlight card shows promoted badge
    const expectedPromotedBadge = getTranslation('en', 'results.promotedBadge').replace('{rank}', '2');
    expect(appHtml).toContain(expectedPromotedBadge);

    // PrintablePlan reflects promoted plan
    const { PrintablePlan } = await import('../components/PrintablePlan');
    const printHtml = renderToStaticMarkup(createElement(PrintablePlan));
    expect(printHtml).toContain(planToPromote.name.en);
    expect(printHtml).toContain('Active Plan · Promoted from #2');
    expect(printHtml).toContain(getTranslation('en', 'conditions.waterPumpWell'));
    expect(printHtml).toContain('3.2');
    expect(printHtml).toContain('Lower terrace near creek');
  });

  it.each(['en', 'fil'] as const)('provides accessible close aria-label on MethodologyModal and interactive trait tooltips on RotationCard (%s)', async (language) => {
    useAppStore.setState({ isMethodologyModalOpen: true, language });
    const { MethodologyModal } = await import('../components/MethodologyModal');
    const methodologyHtml = renderToStaticMarkup(createElement(MethodologyModal));
    expect(methodologyHtml).toContain(`aria-label="${getTranslation(language, 'provenance.closeMethodology')}"`);

    await useAppStore.getState().selectPilotPreset(PILOT_LOCATIONS[0]);
    const plan = useAppStore.getState().recommendedPlans[0];
    const { RotationCard } = await import('../components/RotationCard');
    const cardHtml = renderToStaticMarkup(createElement(RotationCard, { plan, rank: 1 }));

    // Trait badge buttons with aria-expanded="false"
    expect(cardHtml).toContain('aria-expanded="false"');
    expect(cardHtml).toMatch(/<button[^>]*aria-expanded="false"[^>]*>GRASS<\/button>|<button[^>]*aria-expanded="false"[^>]*>grass<\/button>/i);
    expect(cardHtml).toMatch(/<button[^>]*aria-expanded="false"[^>]*>\+N Fixer<\/button>/);
    expect(cardHtml).toMatch(/<button[^>]*aria-expanded="false"[^>]*>Water: /);
    expect(cardHtml).toMatch(/<button[^>]*aria-expanded="false"[^>]*>Root: /);
  });
});
