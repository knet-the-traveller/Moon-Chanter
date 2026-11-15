import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SAVED_PLANS_STORAGE_KEY,
  SavedPlanRecordSchema,
  loadSavedPlans,
  savePlanSnapshot,
  deleteSavedPlanSnapshot,
  type SavedPlanRecord
} from '../services/savedPlans';
import { useAppStore } from '../store/useAppStore';
import type { RotationPlan } from '../types';

function createMockLocalStorage() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null
  };
}

const samplePlan: RotationPlan = {
  id: 'plan-1',
  isBaseline: false,
  name: { en: 'Rice - Mungbean - Fallow', local: 'Palay - Munggo - Lupaing Pahinga' },
  seasons: [
    {
      seasonKey: 'wet',
      seasonName: { en: 'Wet Season', local: 'Tag-ulan' },
      periodMonths: 'Jun – Oct',
      crop: {
        id: 'rice',
        name: { en: 'Rice (Lowland)', local: 'Palay' },
        family: 'grass',
        nitrogenFixing: false,
        rootDepth: 'shallow',
        waterDemand: 'high',
        droughtTolerance: 'low',
        floodTolerance: 'high',
        heatTolerance: 'medium',
        seasonLengthDays: 115,
        plantingWindows: ['wet', 'dry_cool'],
        residueBenefit: 'low',
        laborIntensity: 'high',
        inputCost: 'high',
        marketTier: 'high',
        soilPref: {
          texture: ['clay', 'clay_loam'],
          drainage: ['poor', 'moderate']
        },
        notes: 'Primary cereal staple',
        sources: ['PhilRice']
      },
      role: 'Staple'
    }
  ],
  scores: {
    overall: 88,
    soilHealth: 85,
    waterResilience: 80,
    climateRisk: 82,
    economics: 75,
    labor: 70
  },
  scenarioScores: {
    baseline: 88,
    hotter: 80,
    drier: 72,
    compound: 68,
    wetter: 85,
    hotterAndDrier: 70,
    hotter_drier: 70
  },
  robustness: 'robust',
  reasons: [
    {
      id: 'reason-1',
      ruleId: 'AGRO-RULE-01',
      category: 'soil',
      textEn: 'Improves soil health',
      textFil: 'Nagpapaganda ng kalusugan ng lupa',
      dataEvidence: 'Legume break'
    }
  ],
  risks: [
    {
      id: 'risk-1',
      ruleId: 'AGRO-RULE-06-WATER-ACCESS',
      textEn: 'Canal schedule restriction',
      textFil: 'Pangangasiwa sa iskedyul ng kanal',
      mitigationEn: 'Coordinate with IA',
      mitigationFil: 'Makipag-ugnayan sa IA'
    }
  ]
};

const makeSampleRecord = (overrides?: Partial<SavedPlanRecord>): SavedPlanRecord => ({
  id: 'saved-rec-1',
  savedAtIso: '2026-11-15T12:00:00.000Z',
  savedAt: 1794744000000,
  rankIndex: 1,
  location: {
    id: 'munoz',
    name: 'Science City of Muñoz',
    province: 'Nueva Ecija',
    region: 'Central Luzon',
    lat: 15.714,
    lon: 120.906,
    elevationMeters: 35
  },
  waterSource: 'irrigation_canal',
  fieldSizeHa: 1.5,
  plotNotes: 'Near north lateral canal gate',
  priorities: {
    soilHealth: 80,
    waterResilience: 75,
    stableIncome: 70,
    lowInputCost: 65,
    lowLabor: 50,
    climateRisk: 75
  },
  recentCropId: 'rice',
  excludedCropIds: [],
  soilOverride: null,
  isMunicipalBaselineActive: false,
  useDemoAssumptions: true,
  activeScenario: 'baseline',
  plan: samplePlan,
  ...overrides
});

describe('Saved Plans Service (savedPlans.ts)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMockLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exports constant SAVED_PLANS_STORAGE_KEY', () => {
    expect(SAVED_PLANS_STORAGE_KEY).toBe('anitala_saved_plans_v1');
  });

  it('validates a correct SavedPlanRecordSchema', () => {
    const record = makeSampleRecord();
    const result = SavedPlanRecordSchema.safeParse(record);
    expect(result.success).toBe(true);
  });

  it('loadSavedPlans() returns [] when localStorage is empty, "{bad", non-array, or contains corrupted items (Review Focus #1)', () => {
    // When globalThis.localStorage is undefined
    vi.stubGlobal('localStorage', undefined);
    expect(loadSavedPlans()).toEqual([]);

    // Restore mock storage
    vi.stubGlobal('localStorage', createMockLocalStorage());

    // Empty
    expect(loadSavedPlans()).toEqual([]);

    // Malformed JSON
    localStorage.setItem(SAVED_PLANS_STORAGE_KEY, '{bad json');
    expect(loadSavedPlans()).toEqual([]);

    // Non-array JSON
    localStorage.setItem(SAVED_PLANS_STORAGE_KEY, '123');
    expect(loadSavedPlans()).toEqual([]);

    localStorage.setItem(SAVED_PLANS_STORAGE_KEY, JSON.stringify({ not: 'an array' }));
    expect(loadSavedPlans()).toEqual([]);

    // Mixed array: 1 valid, 2 invalid
    const validRec = makeSampleRecord();
    const invalidRec1 = { notEvenClose: 42 };
    const invalidRec2 = { ...validRec, waterSource: 'not_a_valid_source' };

    localStorage.setItem(
      SAVED_PLANS_STORAGE_KEY,
      JSON.stringify([validRec, invalidRec1, invalidRec2])
    );

    const loaded = loadSavedPlans();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe(validRec.id);
  });

  it('savePlanSnapshot() deduplicates by plan.id + lat + lon + waterSource and caps at 20 entries', () => {
    const rec1 = makeSampleRecord({ id: 'rec-1', plotNotes: 'first note' });
    savePlanSnapshot(rec1);

    expect(loadSavedPlans()).toHaveLength(1);
    expect(loadSavedPlans()[0].plotNotes).toBe('first note');

    // Saving updated version with same plan.id, location coords, waterSource replaces/deduplicates
    const rec1Updated = makeSampleRecord({ id: 'rec-1-updated', plotNotes: 'updated note' });
    savePlanSnapshot(rec1Updated);

    const afterDedup = loadSavedPlans();
    expect(afterDedup).toHaveLength(1);
    expect(afterDedup[0].id).toBe('rec-1-updated');
    expect(afterDedup[0].plotNotes).toBe('updated note');

    // Different water source or coordinates is not deduplicated
    const recRainfed = makeSampleRecord({
      id: 'rec-rainfed',
      waterSource: 'rainfed'
    });
    savePlanSnapshot(recRainfed);
    expect(loadSavedPlans()).toHaveLength(2);

    // Caps at 20 entries
    for (let i = 0; i < 25; i++) {
      savePlanSnapshot(
        makeSampleRecord({
          id: `rec-bulk-${i}`,
          location: {
            name: `Test Field ${i}`,
            province: 'Test',
            region: 'Test',
            lat: 10 + i * 0.1,
            lon: 120 + i * 0.1,
            elevationMeters: 20
          }
        })
      );
    }
    const capped = loadSavedPlans();
    expect(capped.length).toBe(20);
  });

  it('deleteSavedPlanSnapshot() removes the target record by id', () => {
    const rec1 = makeSampleRecord({ id: 'to-delete' });
    const rec2 = makeSampleRecord({
      id: 'to-keep',
      location: { ...rec1.location, lat: 14.1 }
    });
    savePlanSnapshot(rec1);
    savePlanSnapshot(rec2);
    expect(loadSavedPlans()).toHaveLength(2);

    deleteSavedPlanSnapshot('to-delete');
    const remaining = loadSavedPlans();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('to-keep');
  });
});

describe('useAppStore AniTala Extensions', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMockLocalStorage());
    useAppStore.setState(useAppStore.getInitialState(), true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initializes default AniTala store values', () => {
    const state = useAppStore.getState();
    expect(state.waterSource).toBe('irrigation_canal');
    expect(state.fieldSizeHa).toBeNull();
    expect(state.plotNotes).toBe('');
    expect(state.isMapExpanded).toBe(false);
    expect(state.isSavedPlansOpen).toBe(false);
    expect(state.activeSpotlightPlanId).toBeNull();
    expect(Array.isArray(state.savedPlans)).toBe(true);
  });

  it('setWaterSource() updates waterSource in store and triggers computeRecommendations', () => {
    const { setWaterSource } = useAppStore.getState();
    setWaterSource('pump_well');
    expect(useAppStore.getState().waterSource).toBe('pump_well');

    setWaterSource('rainfed');
    expect(useAppStore.getState().waterSource).toBe('rainfed');
  });

  it('setFieldSizeHa() stores valid finite [0, 10000] rounded to 2 decimals, accepts null, ignores invalid (Review Focus #5)', () => {
    const { setFieldSizeHa } = useAppStore.getState();

    // Valid number
    setFieldSizeHa(2.456);
    expect(useAppStore.getState().fieldSizeHa).toBe(2.46);

    // Boundary 0
    setFieldSizeHa(0);
    expect(useAppStore.getState().fieldSizeHa).toBe(0);

    // Boundary 10000
    setFieldSizeHa(10000);
    expect(useAppStore.getState().fieldSizeHa).toBe(10000);

    // Null clears
    setFieldSizeHa(null);
    expect(useAppStore.getState().fieldSizeHa).toBeNull();

    // Reset to 5 for invalid tests
    setFieldSizeHa(5);
    expect(useAppStore.getState().fieldSizeHa).toBe(5);

    // Ignores negative
    setFieldSizeHa(-2);
    expect(useAppStore.getState().fieldSizeHa).toBe(5);

    // Ignores > 10000
    setFieldSizeHa(25000);
    expect(useAppStore.getState().fieldSizeHa).toBe(5);

    // Ignores NaN & Infinity
    setFieldSizeHa(Number.NaN);
    expect(useAppStore.getState().fieldSizeHa).toBe(5);

    setFieldSizeHa(Number.POSITIVE_INFINITY);
    expect(useAppStore.getState().fieldSizeHa).toBe(5);
  });

  it('setPlotNotes() trims and caps at 500 characters', () => {
    const { setPlotNotes } = useAppStore.getState();
    setPlotNotes('Short notes');
    expect(useAppStore.getState().plotNotes).toBe('Short notes');

    const longText = 'a'.repeat(600);
    setPlotNotes(longText);
    expect(useAppStore.getState().plotNotes.length).toBe(500);
  });

  it('setMapExpanded() and setSavedPlansOpen() toggle modal/drawer states', () => {
    const { setMapExpanded, setSavedPlansOpen } = useAppStore.getState();

    setMapExpanded(true);
    expect(useAppStore.getState().isMapExpanded).toBe(true);
    setMapExpanded(false);
    expect(useAppStore.getState().isMapExpanded).toBe(false);

    setSavedPlansOpen(true);
    expect(useAppStore.getState().isSavedPlansOpen).toBe(true);
    setSavedPlansOpen(false);
    expect(useAppStore.getState().isSavedPlansOpen).toBe(false);
  });

  it('promotePlan() sets activeSpotlightPlanId, and computeRecommendations() auto-resets it when plan is absent (Review Focus #4)', () => {
    const { promotePlan, computeRecommendations } = useAppStore.getState();

    // Promoting a plan sets activeSpotlightPlanId
    promotePlan('plan-custom-99');
    expect(useAppStore.getState().activeSpotlightPlanId).toBe('plan-custom-99');

    // When telemetry/climate is null, computeRecommendations clears spotlight
    computeRecommendations();
    expect(useAppStore.getState().activeSpotlightPlanId).toBeNull();

    // Now pretend recommendedPlans exists
    useAppStore.setState({
      recommendedPlans: [samplePlan]
    });
    promotePlan(samplePlan.id);
    expect(useAppStore.getState().activeSpotlightPlanId).toBe(samplePlan.id);

    // If activeSpotlightPlanId is set to an ID not in recommendedPlans during computeRecommendations:
    promotePlan('ghost-plan-xyz');
    // If telemetry is not loaded, computeRecommendations clears recommendedPlans & spotlight
    computeRecommendations();
    expect(useAppStore.getState().activeSpotlightPlanId).toBeNull();
  });

  it('savePlan(plan) persists full farm inputs and RotationPlan into localStorage and store (Review Focus #1)', () => {
    useAppStore.setState({
      waterSource: 'rainfed',
      fieldSizeHa: 2.5,
      plotNotes: 'Rainfed upland test plot',
      recentCropId: 'corn',
      excludedCropIds: ['cassava'],
      activeScenario: 'drier'
    });

    useAppStore.getState().savePlan(samplePlan, 1);

    const savedInStore = useAppStore.getState().savedPlans;
    expect(savedInStore).toHaveLength(1);
    expect(savedInStore[0].waterSource).toBe('rainfed');
    expect(savedInStore[0].fieldSizeHa).toBe(2.5);
    expect(savedInStore[0].plotNotes).toBe('Rainfed upland test plot');
    expect(savedInStore[0].recentCropId).toBe('corn');
    expect(savedInStore[0].excludedCropIds).toEqual(['cassava']);
    expect(savedInStore[0].activeScenario).toBe('drier');
    expect(savedInStore[0].plan.id).toBe(samplePlan.id);

    // Verify localStorage key
    const rawStorage = localStorage.getItem(SAVED_PLANS_STORAGE_KEY);
    expect(rawStorage).toBeTruthy();
    const parsed = JSON.parse(rawStorage!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].waterSource).toBe('rainfed');
  });

  it('removeSavedPlan(id) removes the plan from localStorage and state', () => {
    useAppStore.getState().savePlan(samplePlan, 1);
    const savedId = useAppStore.getState().savedPlans[0].id;

    useAppStore.getState().removeSavedPlan(savedId);
    expect(useAppStore.getState().savedPlans).toHaveLength(0);
    expect(loadSavedPlans()).toHaveLength(0);
  });

  it('restoreSavedPlan(savedId) restores farm inputs, navigates to Step 4, closes modal, and populates recommendedPlans', () => {
    // Save a custom record
    const record = makeSampleRecord({
      id: 'saved-target',
      waterSource: 'pump_well',
      fieldSizeHa: 3.25,
      plotNotes: 'Deep well irrigation lot',
      recentCropId: 'onion',
      excludedCropIds: ['eggplant'],
      activeScenario: 'hotter'
    });
    savePlanSnapshot(record);
    useAppStore.setState({
      savedPlans: loadSavedPlans(),
      isSavedPlansOpen: true,
      currentStep: 1,
      waterSource: 'irrigation_canal',
      fieldSizeHa: null,
      plotNotes: '',
      recommendedPlans: []
    });

    useAppStore.getState().restoreSavedPlan('saved-target');

    const state = useAppStore.getState();
    expect(state.waterSource).toBe('pump_well');
    expect(state.fieldSizeHa).toBe(3.25);
    expect(state.plotNotes).toBe('Deep well irrigation lot');
    expect(state.recentCropId).toBe('onion');
    expect(state.excludedCropIds).toEqual(['eggplant']);
    expect(state.activeScenario).toBe('hotter');
    expect(state.currentStep).toBe(4);
    expect(state.isSavedPlansOpen).toBe(false);
    expect(state.activeSpotlightPlanId).toBe(samplePlan.id);
    expect(state.recommendedPlans).toHaveLength(1);
    expect(state.recommendedPlans[0].id).toBe(samplePlan.id);
  });
});
