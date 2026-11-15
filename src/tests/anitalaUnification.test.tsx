import { Children, createElement, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enJson from '../i18n/en.json';
import filJson from '../i18n/fil.json';
import cropsData from '../data/crops.json';
import { PILOT_LOCATIONS } from '../data/pilotLocations';
import { getTranslation } from '../i18n';
import { calculateSequenceScores, WATER_ACCESS_RULE_METADATA } from '../engine/scoring';
import { CacheService } from '../services/cache';
import { DEMO_SOIL_SOURCE } from '../services/planningSoil';
import {
  loadSavedPlans,
  SAVED_PLANS_STORAGE_KEY,
  SavedPlanRecordSchema
} from '../services/savedPlans';
import type { SavedPlanRecord } from '../services/savedPlans';
import { useAppStore } from '../store/useAppStore';
import type { ClimateData, Crop, SoilData } from '../types';
import { App } from '../App';
import { ComparisonModal } from '../components/ComparisonModal';
import { MapPicker } from '../components/MapPicker';
import { MethodologyModal } from '../components/MethodologyModal';
import { Navbar } from '../components/Navbar';
import { PrintablePlan } from '../components/PrintablePlan';
import { PrioritiesSection } from '../components/PrioritiesSection';
import { RotationCard } from '../components/RotationCard';
import { SavedPlansModal } from '../components/SavedPlansModal';

const hookAdapter = vi.hoisted(() => ({
  captureHooks: false,
  effects: [] as Array<() => unknown>,
  refs: [] as Array<{ current: unknown }>,
  states: [] as Array<{ value: unknown; set: ReturnType<typeof vi.fn> }>,
  refCursor: 0,
  stateCursor: 0
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useEffect: (effect: () => unknown, deps?: readonly unknown[]) => {
      if (hookAdapter.captureHooks) {
        hookAdapter.effects.push(effect);
        return;
      }
      return actual.useEffect(effect as () => void | (() => void), deps as React.DependencyList | undefined);
    },
    useRef: <T,>(initialValue: T) => {
      if (hookAdapter.captureHooks) {
        const index = hookAdapter.refCursor++;
        hookAdapter.refs[index] ??= { current: initialValue };
        return hookAdapter.refs[index] as React.MutableRefObject<T>;
      }
      return actual.useRef(initialValue);
    },
    useState: <T,>(initialValue: T | (() => T)) => {
      if (hookAdapter.captureHooks) {
        const index = hookAdapter.stateCursor++;
        const resolved = typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
        hookAdapter.states[index] ??= {
          value: resolved,
          set: vi.fn((next: unknown) => {
            const prev = hookAdapter.states[index].value;
            hookAdapter.states[index].value = typeof next === 'function' ? (next as (p: unknown) => unknown)(prev) : next;
          })
        };
        return [hookAdapter.states[index].value as T, hookAdapter.states[index].set as React.Dispatch<React.SetStateAction<T>>] as const;
      }
      return actual.useState(initialValue);
    }
  };
});

vi.mock('leaflet', () => ({ default: {} }));
vi.mock('../store/useAppStore', async (importOriginal) => {
  const original = await importOriginal<typeof import('../store/useAppStore')>();
  const mockStoreHook = <T,>(selector?: (state: ReturnType<typeof original.useAppStore.getState>) => T) => {
    const state = original.useAppStore.getState();
    return selector ? selector(state) : state;
  };
  return {
    useAppStore: Object.assign(mockStoreHook, original.useAppStore)
  };
});

const CROPS = cropsData as Crop[];
const cropById = (id: string): Crop => {
  const found = CROPS.find((c) => c.id === id);
  if (!found) throw new Error(`Missing test crop ${id}`);
  return found;
};

const TEST_SOIL: SoilData = {
  source: 'ISRIC SoilGrids v2.0 Test',
  texture: 'loam',
  drainage: 'well',
  organicMatter: 'medium',
  ph: 6.2,
  isEstimate: false,
  rawClayPercent: 20,
  rawSandPercent: 40,
  rawSocDgPerKg: 130
};

const MODERATE_WATER_CLIMATE: ClimateData = {
  source: 'NASA POWER Climatology Test',
  variableList: ['T2M', 'T2M_MAX', 'T2M_MIN', 'PRECTOTCORR', 'RH2M'],
  dateRange: '2014-2024 Test',
  isSampleData: false,
  meanAnnualPrecipitation: 1200,
  meanAnnualTemp: 27.5,
  seasonalStats: {
    wet: { precip: 900, avgTemp: 27.5, maxTemp: 32.0 },
    dryCool: { precip: 65, avgTemp: 25.0, maxTemp: 31.0 },
    dryHot: { precip: 235, avgTemp: 29.0, maxTemp: 34.5 }
  },
  monthly: [
    { month: 'Jan', monthNum: 1, temp: 25.0, tempMax: 30.5, tempMin: 20.0, rainfall: 15, solarRadiation: 16.0, humidity: 74 },
    { month: 'Jul', monthNum: 7, temp: 27.5, tempMax: 32.0, tempMin: 23.5, rainfall: 260, solarRadiation: 15.5, humidity: 84 }
  ],
  heatStressDaysPerYear: 18,
  drySpellRisk: 'moderate',
  excessWaterRisk: 'low',
  heatRisk: 'moderate',
  tenYearRainfallTrend: 'stable',
  trendDeltaPercent: 0
};

const DEFAULT_PRIORITIES = {
  soilHealth: 50,
  waterResilience: 50,
  stableIncome: 50,
  lowInputCost: 50,
  lowLabor: 50,
  climateRisk: 50
};

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    }
  };
}

function collectLeafEntries(node: unknown, prefix = ''): Array<[string, string]> {
  if (typeof node === 'string') {
    return [[prefix, node]];
  }
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    throw new Error(`Unexpected non-string/non-object i18n value at "${prefix}"`);
  }
  const entries: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    const nextPath = prefix ? `${prefix}.${key}` : key;
    entries.push(...collectLeafEntries(value, nextPath));
  }
  return entries.sort(([a], [b]) => a.localeCompare(b));
}

function extractPlaceholders(value: string): string[] {
  return (value.match(/\{[a-zA-Z0-9_]+\}/g) ?? []).slice().sort();
}

function findElements(
  tree: ReactNode,
  predicate: (el: ReactElement<Record<string, unknown>>) => boolean
): Array<ReactElement<Record<string, unknown>>> {
  const matches: Array<ReactElement<Record<string, unknown>>> = [];
  const walk = (node: ReactNode) => {
    Children.forEach(node, (child) => {
      if (!isValidElement<Record<string, unknown>>(child)) return;
      if (predicate(child)) matches.push(child);
      if (child.props.children) walk(child.props.children as ReactNode);
    });
  };
  walk(tree);
  return matches;
}

describe('AniTala UI Unification & Integration Verification', () => {
  beforeEach(async () => {
    hookAdapter.captureHooks = false;
    hookAdapter.effects.length = 0;
    hookAdapter.refs.length = 0;
    hookAdapter.states.length = 0;
    hookAdapter.refCursor = 0;
    hookAdapter.stateCursor = 0;

    vi.stubGlobal('localStorage', createMemoryStorage());
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await CacheService.clear();
    useAppStore.setState(
      { ...useAppStore.getInitialState(), savedPlans: [], useDemoAssumptions: false },
      true
    );
  });

  afterEach(() => {
    hookAdapter.captureHooks = false;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('a. User-facing AniTala branding & preserved internal provenance', () => {
    it('uses AniTala in EN/FIL titles and renders AniTala chrome without legacy user-facing titles', async () => {
      expect(enJson.app.title).toContain('AniTala');
      expect(filJson.app.title).toContain('AniTala');
      expect(enJson.print.title).toContain('AniTala');
      expect(filJson.print.title).toContain('AniTala');

      for (const value of [enJson.app.title, filJson.app.title, enJson.print.title, filJson.print.title]) {
        expect(value).not.toContain('FieldShift Crop Rotation Planner');
        expect(value).not.toContain('FieldShift Crop Rotation Advisory Plan');
        expect(value).not.toContain('FieldShift');
      }

      await useAppStore.getState().selectPilotPreset(PILOT_LOCATIONS[0]);
      useAppStore.getState().setSoilOverride({ texture: 'loam', drainage: 'well' });
      const plans = useAppStore.getState().recommendedPlans;
      useAppStore.setState({
        isMethodologyModalOpen: true,
        isComparisonModalOpen: true,
        comparedPlanIds: plans.slice(0, 2).map((p) => p.id),
        advisoryIssuedAt: 1763210001234
      });

      const navbarHtml = renderToStaticMarkup(createElement(Navbar));
      expect(navbarHtml).toContain('AniTala');
      expect(navbarHtml).not.toContain('FieldShift');

      const methodologyHtml = renderToStaticMarkup(createElement(MethodologyModal));
      expect(methodologyHtml).toContain('AniTala Methodology');
      expect(methodologyHtml).toContain('[AGRO-RULE-06-WATER-ACCESS]');
      expect(methodologyHtml).not.toContain('FieldShift');

      const comparisonHtml = renderToStaticMarkup(createElement(ComparisonModal));
      const comparisonVisibleChrome = comparisonHtml.replace(/<details\b[\s\S]*?<\/details>/g, '');
      expect(comparisonVisibleChrome).toContain('AniTala Agronomic Decision Support');
      expect(comparisonVisibleChrome).not.toContain('FieldShift');

      const printHtml = renderToStaticMarkup(createElement(PrintablePlan));
      expect(printHtml).toContain('AniTala · Farm Advisory Sheet');
      expect(printHtml).toMatch(/Advisory Ref:.*?AT-\d+\.\d{2}-1234/);
      expect(printHtml).not.toContain('FieldShift Crop Rotation Advisory Plan');
      expect(printHtml).not.toContain(`FS-${PILOT_LOCATIONS[0].lat.toFixed(2)}`);
    });

    it('preserves internal provenance identifiers inside <details> and demo soil constants', async () => {
      expect(DEMO_SOIL_SOURCE).toBe('FieldShift demonstration assumptions');

      await useAppStore.getState().selectPilotPreset(PILOT_LOCATIONS[0]);
      useAppStore.setState({
        soilData: {
          ...TEST_SOIL,
          source: 'FieldShift municipal soil example (Science City of Muñoz)',
          isEstimate: true,
          needsReview: true
        },
        advisoryIssuedAt: 1763210009999
      });
      useAppStore.getState().computeRecommendations();

      const printHtml = renderToStaticMarkup(createElement(PrintablePlan));
      const detailsMatch = printHtml.match(/<details\b[\s\S]*?<\/details>/);
      expect(detailsMatch).not.toBeNull();
      expect(detailsMatch![0]).toContain('FieldShift municipal soil example');
    });
  });

  describe('b. WaterSource + [AGRO-RULE-06-WATER-ACCESS] engine & store', () => {
    it('exports WATER_ACCESS_RULE_METADATA with needsReview: true and scores dry-season crops by water source', () => {
      expect(WATER_ACCESS_RULE_METADATA.ruleId).toBe('AGRO-RULE-06-WATER-ACCESS');
      expect(WATER_ACCESS_RULE_METADATA.needsReview).toBe(true);
      expect(WATER_ACCESS_RULE_METADATA.note.length).toBeGreaterThan(10);

      const highDemandClimate: ClimateData = {
        ...MODERATE_WATER_CLIMATE,
        seasonalStats: {
          ...MODERATE_WATER_CLIMATE.seasonalStats,
          wet: { precip: 1300, avgTemp: 27.5, maxTemp: 32.0 }
        },
        excessWaterRisk: 'high'
      };
      const highDemandDrySeq = {
        s1Crop: cropById('rice'),
        s2Crop: cropById('rice'),
        s3Crop: cropById('fallow')
      };

      const defaultScore = calculateSequenceScores(
        highDemandDrySeq,
        highDemandClimate,
        TEST_SOIL,
        DEFAULT_PRIORITIES
      );
      const canalScore = calculateSequenceScores(
        highDemandDrySeq,
        highDemandClimate,
        TEST_SOIL,
        DEFAULT_PRIORITIES,
        'irrigation_canal'
      );
      const rainfedHighScore = calculateSequenceScores(
        highDemandDrySeq,
        highDemandClimate,
        TEST_SOIL,
        DEFAULT_PRIORITIES,
        'rainfed'
      );
      const pumpHighScore = calculateSequenceScores(
        highDemandDrySeq,
        highDemandClimate,
        TEST_SOIL,
        DEFAULT_PRIORITIES,
        'pump_well'
      );
      const pondHighScore = calculateSequenceScores(
        highDemandDrySeq,
        highDemandClimate,
        TEST_SOIL,
        DEFAULT_PRIORITIES,
        'small_pond'
      );

      expect(defaultScore).toEqual(canalScore);
      expect(rainfedHighScore.waterResilience).toBeLessThan(canalScore.waterResilience);
      expect(rainfedHighScore.climateRisk).toBeLessThan(canalScore.climateRisk);
      expect(rainfedHighScore.economics).toBeLessThan(canalScore.economics);
      expect(pumpHighScore.waterResilience).toBeLessThan(canalScore.waterResilience);
      expect(pondHighScore.waterResilience).toBeLessThan(canalScore.waterResilience);

      // Low water-demand, drought-tolerant dry-season crop earns water bonus under rainfed & small_pond
      const droughtResilientSeq = {
        s1Crop: cropById('eggplant'),
        s2Crop: cropById('peanut'),
        s3Crop: cropById('fallow')
      };
      const canalLowScore = calculateSequenceScores(
        droughtResilientSeq,
        highDemandClimate,
        TEST_SOIL,
        DEFAULT_PRIORITIES,
        'irrigation_canal'
      );
      const rainfedLowScore = calculateSequenceScores(
        droughtResilientSeq,
        highDemandClimate,
        TEST_SOIL,
        DEFAULT_PRIORITIES,
        'rainfed'
      );
      const pondLowScore = calculateSequenceScores(
        droughtResilientSeq,
        highDemandClimate,
        TEST_SOIL,
        DEFAULT_PRIORITIES,
        'small_pond'
      );

      expect(rainfedLowScore.waterResilience).toBe(canalLowScore.waterResilience + 6);
      expect(pondLowScore.waterResilience).toBe(canalLowScore.waterResilience + 3);
    });

    it('updates waterSource, fieldSizeHa, and plotNotes via useAppStore actions cleanly', async () => {
      await useAppStore.getState().selectPilotPreset(PILOT_LOCATIONS[0]);
      useAppStore.getState().setSoilOverride({ texture: 'loam', drainage: 'well' });

      const canalTopWater = useAppStore.getState().recommendedPlans.find((p) =>
        p.seasons.slice(1).some((s) => s.crop.waterDemand === 'high')
      )?.scores.waterResilience;

      useAppStore.getState().setWaterSource('rainfed');
      expect(useAppStore.getState().waterSource).toBe('rainfed');

      if (canalTopWater !== undefined) {
        const rainfedSameHighDemand = useAppStore.getState().recommendedPlans.find((p) =>
          p.seasons.slice(1).some((s) => s.crop.waterDemand === 'high')
        );
        if (rainfedSameHighDemand) {
          expect(rainfedSameHighDemand.scores.waterResilience).toBeLessThan(canalTopWater);
        }
      }

      useAppStore.getState().setFieldSizeHa(2.758);
      expect(useAppStore.getState().fieldSizeHa).toBe(2.76);
      useAppStore.getState().setFieldSizeHa(-5);
      expect(useAppStore.getState().fieldSizeHa).toBe(2.76);
      useAppStore.getState().setFieldSizeHa(null);
      expect(useAppStore.getState().fieldSizeHa).toBeNull();

      useAppStore.getState().setPlotNotes('x'.repeat(550));
      expect(useAppStore.getState().plotNotes).toHaveLength(500);
    });
  });

  describe('c. Saved plans persistence, Zod validation & Step 4 baseline pin', () => {
    it('supports savePlan, restoreSavedPlan, removeSavedPlan, and Zod validation on corrupted storage', async () => {
      await useAppStore.getState().selectPilotPreset(PILOT_LOCATIONS[0]);
      useAppStore.getState().setSoilOverride({ texture: 'loam', drainage: 'well' });
      useAppStore.getState().setWaterSource('pump_well');
      useAppStore.getState().setFieldSizeHa(1.8);
      useAppStore.getState().setPlotNotes('Upper dike plot');

      const targetPlan = useAppStore.getState().recommendedPlans[1];
      useAppStore.getState().savePlan(targetPlan, 2);

      const saved = useAppStore.getState().savedPlans;
      expect(saved).toHaveLength(1);
      const savedRecord = saved[0];
      expect(SavedPlanRecordSchema.safeParse(savedRecord).success).toBe(true);

      // Mutate store state away from saved snapshot, then restore
      useAppStore.getState().setWaterSource('rainfed');
      useAppStore.getState().setFieldSizeHa(9.9);
      useAppStore.getState().setPlotNotes('Changed plot');
      useAppStore.setState({ currentStep: 2, isSavedPlansOpen: true });

      useAppStore.getState().restoreSavedPlan(savedRecord.id);
      const restoredState = useAppStore.getState();
      expect(restoredState.waterSource).toBe('pump_well');
      expect(restoredState.fieldSizeHa).toBe(1.8);
      expect(restoredState.plotNotes).toBe('Upper dike plot');
      expect(restoredState.currentStep).toBe(4);
      expect(restoredState.isSavedPlansOpen).toBe(false);
      expect(restoredState.activeSpotlightPlanId).toBe(targetPlan.id);

      // Zod rejects unsupported waterSource
      expect(
        SavedPlanRecordSchema.safeParse({ ...savedRecord, waterSource: 'desalination' }).success
      ).toBe(false);

      // Corrupted entries mixed with valid snapshot are filtered safely by loadSavedPlans
      globalThis.localStorage.setItem(
        SAVED_PLANS_STORAGE_KEY,
        JSON.stringify([{ invalid: true }, savedRecord])
      );
      expect(loadSavedPlans()).toHaveLength(1);

      globalThis.localStorage.setItem(SAVED_PLANS_STORAGE_KEY, '{not-valid-json');
      expect(loadSavedPlans()).toEqual([]);

      // Restore valid record back and remove via store
      globalThis.localStorage.setItem(SAVED_PLANS_STORAGE_KEY, JSON.stringify([savedRecord]));
      useAppStore.getState().removeSavedPlan(savedRecord.id);
      expect(useAppStore.getState().savedPlans).toEqual([]);
      expect(loadSavedPlans()).toEqual([]);
    });

    it('keeps isBaseline visible in Other Good Crop Plans immediately when a non-baseline plan is spotlighted', async () => {
      await useAppStore.getState().selectPilotPreset(PILOT_LOCATIONS[0]);
      useAppStore.getState().setSoilOverride({ texture: 'loam', drainage: 'well' });
      const plans = useAppStore.getState().recommendedPlans;
      const baselinePlan = plans.find((p) => p.isBaseline);
      const nonBaselinePlan = plans.find((p) => !p.isBaseline);
      expect(baselinePlan).toBeDefined();
      expect(nonBaselinePlan).toBeDefined();

      useAppStore.setState({
        currentStep: 4,
        language: 'en',
        activeSpotlightPlanId: nonBaselinePlan!.id
      });

      const appHtml = renderToStaticMarkup(createElement(App));
      const otherSectionStart = appHtml.indexOf(getTranslation('en', 'results.otherGoodPlans'));
      expect(otherSectionStart).toBeGreaterThan(-1);
      const otherSectionHtml = appHtml.slice(otherSectionStart);
      expect(otherSectionHtml).toContain(baselinePlan!.name.en);
    });
  });

  describe('d. Bilingual EN/FIL i18n parity', () => {
    it('maintains identical nested leaf keys and {placeholder} parameters between en.json and fil.json', () => {
      const enLeaves = collectLeafEntries(enJson);
      const filLeaves = collectLeafEntries(filJson);

      expect(enLeaves.map(([path]) => path)).toEqual(filLeaves.map(([path]) => path));

      const filMap = new Map(filLeaves);
      for (const [keyPath, enVal] of enLeaves) {
        const filVal = filMap.get(keyPath);
        expect(enVal.trim().length, `Empty EN string at ${keyPath}`).toBeGreaterThan(0);
        expect(filVal?.trim().length ?? 0, `Empty FIL string at ${keyPath}`).toBeGreaterThan(0);
        expect(extractPlaceholders(filVal!), `Placeholder mismatch at ${keyPath}`).toEqual(
          extractPlaceholders(enVal)
        );
      }
    });
  });

  describe('e. Accessibility & deferred polish checks', () => {
    it('localizes Step 4 App chrome (print button, comparison queue singular/plural, active spotlight label) in FIL', async () => {
      await useAppStore.getState().selectPilotPreset(PILOT_LOCATIONS[0]);
      useAppStore.getState().setSoilOverride({ texture: 'loam', drainage: 'well' });
      const plans = useAppStore.getState().recommendedPlans;

      expect(getTranslation('en', 'results.printPlanSheet')).toBe('Print Plan Sheet');
      expect(getTranslation('fil', 'results.printPlanSheet')).not.toBe('results.printPlanSheet');
      expect(getTranslation('fil', 'results.activeSpotlight')).not.toBe('results.activeSpotlight');

      useAppStore.setState({
        currentStep: 4,
        language: 'fil',
        comparedPlanIds: [plans[0].id]
      });

      const singleQueueHtml = renderToStaticMarkup(createElement(App));
      expect(singleQueueHtml).toContain(getTranslation('fil', 'results.printPlanSheet'));
      expect(singleQueueHtml).not.toContain('Print Plan Sheet');
      expect(singleQueueHtml).toContain(getTranslation('fil', 'results.activeSpotlight'));
      expect(singleQueueHtml).toContain(
        getTranslation('fil', 'results.comparedQueuedSingular').replace('{count}', '1')
      );
      expect(singleQueueHtml).not.toContain('queued for side-by-side comparison');

      useAppStore.setState({
        comparedPlanIds: [plans[0].id, plans[1].id]
      });
      const pluralQueueHtml = renderToStaticMarkup(createElement(App));
      expect(pluralQueueHtml).toContain(
        getTranslation('fil', 'results.comparedQueuedPlural').replace('{count}', '2')
      );
    });

    it('localizes RotationCard trait badges & Print/Share in FIL and uses dedicated tooltip close aria-label', async () => {
      await useAppStore.getState().selectPilotPreset(PILOT_LOCATIONS[0]);
      useAppStore.getState().setSoilOverride({ texture: 'loam', drainage: 'well' });
      const plan = useAppStore.getState().recommendedPlans.find((p) =>
        p.seasons.some((s) => s.crop.nitrogenFixing)
      );
      expect(plan).toBeDefined();

      useAppStore.setState({ language: 'fil' });
      const filCardHtml = renderToStaticMarkup(createElement(RotationCard, { plan: plan!, rank: 1 }));

      expect(getTranslation('fil', 'results.badgeNFixer')).not.toBe('results.badgeNFixer');
      expect(getTranslation('fil', 'results.printShare')).not.toBe('results.printShare');
      expect(getTranslation('fil', 'results.closeTraitTooltip')).not.toBe('results.closeTraitTooltip');

      expect(filCardHtml).toContain(getTranslation('fil', 'results.badgeNFixer'));
      expect(filCardHtml).toContain(getTranslation('fil', 'results.badgeWater').replace('{demand}', plan!.seasons[0].crop.waterDemand));
      expect(filCardHtml).toContain(getTranslation('fil', 'results.badgeRoot').replace('{depth}', plan!.seasons[0].crop.rootDepth));
      expect(filCardHtml).toContain(getTranslation('fil', 'results.printShare'));
      expect(filCardHtml).not.toContain('>+N Fixer<');
      expect(filCardHtml).not.toContain('Print / Share');

      // Verify tooltip dismiss X aria-label via hook capture
      hookAdapter.captureHooks = true;
      for (const language of ['en', 'fil'] as const) {
        useAppStore.setState({ language });
        hookAdapter.effects.length = 0;
        hookAdapter.states.length = 0;
        hookAdapter.refCursor = 0;
        hookAdapter.stateCursor = 0;

        const tree = RotationCard({ plan: plan!, rank: 1 }) as ReactNode;
        const traitButtons = findElements(
          tree,
          (el) => el.type === 'button' && el.props['aria-expanded'] === false && typeof el.props.onClick === 'function'
        );
        expect(traitButtons.length).toBeGreaterThan(0);
        (traitButtons[0].props.onClick as () => void)();

        hookAdapter.refCursor = 0;
        hookAdapter.stateCursor = 0;
        hookAdapter.effects.length = 0;
        const expandedTree = RotationCard({ plan: plan!, rank: 1 }) as ReactNode;
        const closeButtons = findElements(
          expandedTree,
          (el) => el.type === 'button' && el.props.children === '✕'
        );
        expect(closeButtons).toHaveLength(1);
        expect(closeButtons[0].props['aria-label']).toBe(getTranslation(language, 'results.closeTraitTooltip'));
        expect(closeButtons[0].props['aria-label']).not.toBe(getTranslation(language, 'provenance.closeMethodology'));
      }
    });

    it('renders accessible, localized SavedPlansModal with mapped compound scenario label and Escape close cleanup', async () => {
      await useAppStore.getState().selectPilotPreset(PILOT_LOCATIONS[0]);
      useAppStore.getState().setSoilOverride({ texture: 'loam', drainage: 'well' });
      const plan = useAppStore.getState().recommendedPlans[0];

      const compoundRecord: SavedPlanRecord = {
        id: 'saved-compound-1',
        savedAtIso: '2026-11-15T08:00:00.000Z',
        savedAt: 1763193600000,
        rankIndex: 1,
        location: { ...PILOT_LOCATIONS[0] },
        waterSource: 'rainfed',
        fieldSizeHa: 2.0,
        plotNotes: 'Near barangay road',
        priorities: DEFAULT_PRIORITIES,
        recentCropId: null,
        excludedCropIds: [],
        soilOverride: null,
        isMunicipalBaselineActive: false,
        useDemoAssumptions: false,
        activeScenario: 'compound',
        plan
      };

      useAppStore.setState({
        language: 'fil',
        isSavedPlansOpen: true,
        savedPlans: [compoundRecord]
      });

      const modalHtml = renderToStaticMarkup(createElement(SavedPlansModal));
      expect(modalHtml).toContain('role="dialog"');
      expect(modalHtml).toContain('aria-modal="true"');
      expect(modalHtml).toContain(getTranslation('fil', 'results.hotterAndDrier'));
      expect(modalHtml).not.toContain('results.compound');
      expect(modalHtml).toContain(
        getTranslation('fil', 'results.savedSnapshotSingular').replace('{count}', '1')
      );
      expect(modalHtml).toContain(`aria-label="${getTranslation('fil', 'results.closeSavedPlans')}"`);
      expect(modalHtml).not.toContain('aria-label="Close saved plans modal"');
      expect(modalHtml).toContain(getTranslation('fil', 'results.farmRecordsFooter'));
      expect(modalHtml).not.toContain('Farm Records');
      expect(modalHtml).toContain(`>${getTranslation('fil', 'results.closeModal')}<`);

      // Escape key closes SavedPlansModal and cleans up keydown listener
      const listeners = new Map<string, Set<(e: KeyboardEvent) => void>>();
      vi.stubGlobal('window', {
        addEventListener: vi.fn((type: string, fn: (e: KeyboardEvent) => void) => {
          if (!listeners.has(type)) listeners.set(type, new Set());
          listeners.get(type)!.add(fn);
        }),
        removeEventListener: vi.fn((type: string, fn: (e: KeyboardEvent) => void) => {
          listeners.get(type)?.delete(fn);
        })
      });

      hookAdapter.captureHooks = true;
      hookAdapter.effects.length = 0;
      hookAdapter.states.length = 0;
      hookAdapter.refCursor = 0;
      hookAdapter.stateCursor = 0;

      SavedPlansModal({});
      expect(hookAdapter.effects).toHaveLength(1);
      const cleanup = hookAdapter.effects[0]() as (() => void) | undefined;
      expect(listeners.get('keydown')?.size).toBe(1);

      for (const fn of listeners.get('keydown') ?? []) {
        fn({ key: 'Escape' } as KeyboardEvent);
      }
      expect(useAppStore.getState().isSavedPlansOpen).toBe(false);

      cleanup?.();
      expect(listeners.get('keydown')?.size).toBe(0);
    });

    it('adds dialog semantics and Escape dismissal to expanded MapPicker without changing standard view', () => {
      useAppStore.setState({ language: 'en', isMapExpanded: false });
      const normalHtml = renderToStaticMarkup(createElement(MapPicker));
      expect(normalHtml).not.toContain('role="dialog"');
      expect(normalHtml).not.toContain('aria-modal="true"');

      useAppStore.setState({ language: 'fil', isMapExpanded: true });
      const expandedHtml = renderToStaticMarkup(createElement(MapPicker));
      expect(expandedHtml).toContain('role="dialog"');
      expect(expandedHtml).toContain('aria-modal="true"');
      expect(expandedHtml).toContain(`aria-label="${getTranslation('fil', 'map.expandedMapDialog')}"`);

      // Escape key listener closes expanded map and cleans up
      const listeners = new Map<string, Set<(e: KeyboardEvent) => void>>();
      vi.stubGlobal('window', {
        addEventListener: vi.fn((type: string, fn: (e: KeyboardEvent) => void) => {
          if (!listeners.has(type)) listeners.set(type, new Set());
          listeners.get(type)!.add(fn);
        }),
        removeEventListener: vi.fn((type: string, fn: (e: KeyboardEvent) => void) => {
          listeners.get(type)?.delete(fn);
        })
      });

      hookAdapter.captureHooks = true;
      hookAdapter.effects.length = 0;
      hookAdapter.states.length = 0;
      hookAdapter.refs.length = 0;
      hookAdapter.refCursor = 0;
      hookAdapter.stateCursor = 0;

      MapPicker({});
      expect(hookAdapter.effects).toHaveLength(3);
      const cleanup = hookAdapter.effects[2]() as (() => void) | undefined;
      expect(listeners.get('keydown')?.size).toBe(1);

      for (const fn of listeners.get('keydown') ?? []) {
        fn({ key: 'Escape' } as KeyboardEvent);
      }
      expect(useAppStore.getState().isMapExpanded).toBe(false);

      cleanup?.();
      expect(listeners.get('keydown')?.size).toBe(0);
    });

    it('ignores stale excludedCropIds in PrioritiesSection enabledCropCount and lowCropCount warning', () => {
      useAppStore.setState({
        language: 'en',
        excludedCropIds: ['stale_crop_a', 'stale_crop_b']
      });
      const twoStaleHtml = renderToStaticMarkup(createElement(PrioritiesSection));
      expect(twoStaleHtml).toContain('(13 enabled)');

      const twelveStaleIds = Array.from({ length: 12 }, (_, idx) => `stale_crop_${idx}`);
      useAppStore.setState({ excludedCropIds: twelveStaleIds });
      const twelveStaleHtml = renderToStaticMarkup(createElement(PrioritiesSection));
      expect(twelveStaleHtml).toContain('(13 enabled)');
      expect(twelveStaleHtml).not.toContain('role="alert"');
      expect(twelveStaleHtml).not.toContain(getTranslation('en', 'priorities.lowCropWarning'));
    });
  });
});
