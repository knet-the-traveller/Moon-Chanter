import { resolvePlanningSoil } from '../services/planningSoil';
import { create } from 'zustand';
import type {
  Language,
  ClimateData,
  SoilData,
  LandSummary,
  FarmerPriorities,
  RotationPlan,
  ScenarioCondition,
  Crop,
  PilotLocation,
  WaterSource
} from '../types';
import { PILOT_LOCATIONS } from '../data/pilotLocations';
import cropsData from '../data/crops.json';
import { fetchNasaPowerClimate } from '../services/nasaPower';
import {
  fetchSoilGridsData,
  getMunicipalAgriculturalBaseline,
  parseFarmerSoilOverride
} from '../services/soilGrids';
import { generateRotationRecommendations } from '../engine';
import { withTerrainEvidence } from '../services/realLandData';
import { fetchLandSummary } from '../services/landSummary';
import { CoordinatesSchema } from '../types/landFixture';
import { getTranslation } from '../i18n';
import {
  loadSavedPlans,
  savePlanSnapshot,
  deleteSavedPlanSnapshot,
  type SavedPlanRecord
} from '../services/savedPlans';

const allCrops = cropsData as Crop[];
let telemetryRequestId = 0;
let gpsRequestId = 0;
let soilSourceRequestId = 0;
let landController: AbortController | null = null;

interface AppState {
  // Navigation & Preferences
  language: Language;
  currentStep: 1 | 2 | 3 | 4;
  isMethodologyModalOpen: boolean;
  isComparisonModalOpen: boolean;

  // Selected Location
  selectedLocation: {
    id?: string;
    name: string;
    province: string;
    region: string;
    lat: number;
    lon: number;
    elevationMeters: number;
  };

  // Telemetry & Data
  isLoadingTelemetry: boolean;
  telemetryError: string | null;
  climateData: ClimateData | null;
  soilData: SoilData | null;
  telemetrySoilData: SoilData | null;
  isMunicipalBaselineActive: boolean;
  landSummary: LandSummary | null;
  isLoadingLand: boolean;
  landError: string | null;
  isLocatingGps: boolean;
  gpsError: string | null;
  soilOverride: Partial<SoilData> | null;
  useDemoAssumptions:boolean;
  setDemoAssumptions:(enabled:boolean)=>void;

  // Farmer Inputs & History
  waterSource: WaterSource;
  fieldSizeHa: number | null;
  plotNotes: string;
  isMapExpanded: boolean;
  isSavedPlansOpen: boolean;
  activeSpotlightPlanId: string | null;
  savedPlans: SavedPlanRecord[];
  recentCropId: string | null;
  excludedCropIds: string[];
  priorities: FarmerPriorities;

  // Recommendations & Scenarios
  recommendedPlans: RotationPlan[];
  advisoryIssuedAt: number | null;
  activeScenario: ScenarioCondition;
  comparedPlanIds: string[];

  // Actions
  setLanguage: (lang: Language) => void;
  setCurrentStep: (step: 1 | 2 | 3 | 4) => void;
  setMethodologyModalOpen: (open: boolean) => void;
  setComparisonModalOpen: (open: boolean) => void;
  setLocation: (lat: number, lon: number, location?: AppState['selectedLocation']) => Promise<void>;
  locateWithGps: () => void;
  selectPilotPreset: (pilot: PilotLocation) => Promise<void>;
  setCustomCoordinates: (lat: number, lon: number, customName?: string) => Promise<void>;
  fetchTelemetry: (lat: number, lon: number) => Promise<void>;
  applyMunicipalBaseline: () => Promise<void>;
  restoreSoilTelemetry: () => void;
  setSoilOverride: (override: Partial<SoilData>) => void;
  resetSoilOverride: () => void;
  setWaterSource: (waterSource: WaterSource) => void;
  setFieldSizeHa: (val: number | null) => void;
  setPlotNotes: (notes: string) => void;
  setMapExpanded: (open: boolean) => void;
  setSavedPlansOpen: (open: boolean) => void;
  promotePlan: (planId: string | null) => void;
  savePlan: (plan: RotationPlan, rankIndex?: number) => void;
  restoreSavedPlan: (savedId: string) => void;
  removeSavedPlan: (savedId: string) => void;
  setRecentCropId: (cropId: string | null) => void;
  toggleCropExclusion: (cropId: string) => void;
  setPriority: (key: keyof FarmerPriorities, val: number) => void;
  computeRecommendations: () => void;
  setActiveScenario: (scenario: ScenarioCondition) => void;
  togglePlanComparison: (planId: string) => void;
}

const defaultPilot = PILOT_LOCATIONS[0]; // Muñoz, Nueva Ecija

export const useAppStore = create<AppState>((set, get) => ({
  language: 'en',
  currentStep: 1,
  isMethodologyModalOpen: false,
  isComparisonModalOpen: false,

  selectedLocation: {
    id: defaultPilot.id,
    name: defaultPilot.name,
    province: defaultPilot.province,
    region: defaultPilot.region,
    lat: defaultPilot.lat,
    lon: defaultPilot.lon,
    elevationMeters: defaultPilot.elevationMeters
  },

  isLoadingTelemetry: false,
  telemetryError: null,
  climateData: null,
  soilData: null,
  telemetrySoilData: null,
  isMunicipalBaselineActive: false,
  landSummary: null,
  isLoadingLand: false,
  landError: null,
  isLocatingGps: false,
  gpsError: null,
  soilOverride: null,
  useDemoAssumptions:true,
  setDemoAssumptions:(enabled)=>{set({useDemoAssumptions:enabled});get().computeRecommendations();},

  waterSource: 'irrigation_canal',
  fieldSizeHa: null,
  plotNotes: '',
  isMapExpanded: false,
  isSavedPlansOpen: false,
  activeSpotlightPlanId: null,
  savedPlans: loadSavedPlans(),

  recentCropId: 'rice', // Common baseline in Philippines
  excludedCropIds: [],
  priorities: {
    soilHealth: 80,
    waterResilience: 75,
    stableIncome: 70,
    lowInputCost: 65,
    lowLabor: 50,
    climateRisk: 75
  },

  recommendedPlans: [],
  advisoryIssuedAt: null,
  activeScenario: 'baseline',
  comparedPlanIds: [],

  setLanguage: (lang) => set({ language: lang }),
  setCurrentStep: (step) => {
    gpsRequestId += 1;
    set({ currentStep: step, isLocatingGps: false, gpsError: null });
  },
  setMethodologyModalOpen: (open) => set({ isMethodologyModalOpen: open }),
  setComparisonModalOpen: (open) => set({ isComparisonModalOpen: open }),

  setLocation: async (lat, lon, location) => {
    if (!CoordinatesSchema.safeParse({ lat, lon }).success) {
      set({ landError: 'land.invalidCoordinates' });
      return;
    }
    const selectionRequestId = ++telemetryRequestId;
    landController?.abort();
    gpsRequestId += 1;
    const language = get().language;
    const selectedLocation = location ?? {
      name: `${getTranslation(language, 'map.customField')} (${lat.toFixed(3)}°, ${lon.toFixed(3)}°)`,
      province: getTranslation(language, 'map.customProvince'),
      region: getTranslation(language, 'map.customRegion'),
      lat,
      lon,
      elevationMeters: 35
    };
    set({
      selectedLocation: { ...selectedLocation, lat, lon },
      soilOverride: null,
      comparedPlanIds: [],
      climateData: null,
      soilData: null,
      telemetrySoilData: null,
      isMunicipalBaselineActive: false,
      landSummary: null,
      recommendedPlans: [],
      advisoryIssuedAt: null,
      activeSpotlightPlanId: null,
      isLoadingLand: true,
      isLoadingTelemetry: true,
      landError: null,
      telemetryError: null,
      isLocatingGps: false,
      gpsError: null
    });
    if (selectionRequestId !== telemetryRequestId) return;
    await get().fetchTelemetry(lat, lon);
  },

  selectPilotPreset: (pilot) => get().setLocation(pilot.lat, pilot.lon, {
    id: pilot.id,
    name: pilot.name,
    province: pilot.province,
    region: pilot.region,
    lat: pilot.lat,
    lon: pilot.lon,
    elevationMeters: pilot.elevationMeters
  }),

  setCustomCoordinates: (lat, lon, customName) => {
    const language = get().language;
    return get().setLocation(lat, lon, {
      name: customName || `${getTranslation(language, 'map.customField')} (${lat.toFixed(3)}°, ${lon.toFixed(3)}°)`,
      province: getTranslation(language, 'map.customProvince'),
      region: getTranslation(language, 'map.customRegion'),
      lat,
      lon,
      elevationMeters: 35
    });
  },

  locateWithGps: () => {
    const requestId = ++gpsRequestId;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      set({ isLocatingGps: false, gpsError: 'map.gpsUnsupported' });
      return;
    }
    set({ isLocatingGps: true, gpsError: null });
    const failed = () => {
      if (requestId === gpsRequestId) set({ isLocatingGps: false, gpsError: 'map.gpsFailure' });
    };
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (requestId !== gpsRequestId) return;
          set({ isLocatingGps: false });
          void get().setCustomCoordinates(position.coords.latitude, position.coords.longitude,
            getTranslation(get().language, 'map.gpsField'));
        },
        failed,
        { timeout: 10000, enableHighAccuracy: true }
      );
    } catch {
      failed();
    }
  },

  fetchTelemetry: async (lat, lon) => {
    const location = get().selectedLocation;
    if (location.lat !== lat || location.lon !== lon) {
      await get().setLocation(lat, lon);
      return;
    }
    const requestId = ++telemetryRequestId;
    landController?.abort();
    const controller = new AbortController();
    landController = controller;
    const isCurrent = () => requestId === telemetryRequestId;
    const currentSpotlight = get().activeSpotlightPlanId;
    set({
      isLoadingTelemetry: true,
      telemetryError: null,
      isLoadingLand: true,
      landError: null,
      climateData: null,
      soilData: null,
      telemetrySoilData: null,
      isMunicipalBaselineActive: false,
      landSummary: null,
      recommendedPlans: currentSpotlight ? get().recommendedPlans : [],
      advisoryIssuedAt: currentSpotlight ? get().advisoryIssuedAt : null,
      activeSpotlightPlanId: currentSpotlight
    });
    if (!isCurrent()) return;

    const land = fetchLandSummary(lat, lon, controller.signal).then((summary) => {
      if (!isCurrent()) return;
      const currentState = get();
      const updatedTelemetrySoil = currentState.telemetrySoilData
        ? withTerrainEvidence(currentState.telemetrySoilData, summary)
        : null;
      const updatedActiveSoil = currentState.isMunicipalBaselineActive
        ? currentState.soilData
        : (currentState.soilData ? withTerrainEvidence(currentState.soilData, summary) : null);
      set({
        landSummary: summary,
        telemetrySoilData: updatedTelemetrySoil,
        soilData: updatedActiveSoil,
        isLoadingLand: false,
        selectedLocation: { ...currentState.selectedLocation, ...(summary.elevationM === null ? {} : { elevationMeters: summary.elevationM }) }
      });
      get().computeRecommendations();
    }).catch(() => {
      if (isCurrent()) set({ isLoadingLand: false, landError: 'land.unavailable' });
    });

    const telemetry = Promise.allSettled([
      fetchNasaPowerClimate(lat, lon), fetchSoilGridsData(lat, lon)
    ]).then(([climate, soil]) => {
      if (!isCurrent()) return;
      const failed = climate.status === 'rejected' || soil.status === 'rejected';
      const resolvedTelemetrySoil = soil.status === 'fulfilled'
        ? withTerrainEvidence(soil.value, get().landSummary)
        : null;
      set({
        climateData: climate.status === 'fulfilled' ? climate.value : null,
        telemetrySoilData: resolvedTelemetrySoil,
        soilData: get().isMunicipalBaselineActive ? get().soilData : resolvedTelemetrySoil,
        isLoadingTelemetry: false,
        telemetryError: failed ? 'land.telemetryUnavailable' : null
      });
      get().computeRecommendations();
    });

    await Promise.all([land, telemetry]);
    if (isCurrent()) landController = null;
  },

  applyMunicipalBaseline: async () => {
    const requestId = telemetryRequestId;
    const sourceRequestId = ++soilSourceRequestId;
    const { selectedLocation, soilOverride } = get();
    try {
      const baseline = await getMunicipalAgriculturalBaseline(selectedLocation.lat, selectedLocation.lon);
      if (requestId !== telemetryRequestId || sourceRequestId !== soilSourceRequestId) return;
      const current = get();
      set({
        telemetrySoilData: current.telemetrySoilData ?? (current.isMunicipalBaselineActive ? null : current.soilData),
        soilData: baseline,
        // Keep explicit field edits made while baseline acquisition was pending.
        soilOverride: current.soilOverride === soilOverride ? null : current.soilOverride,
        isMunicipalBaselineActive: true,
        telemetryError: null
      });
      get().computeRecommendations();
    } catch {
      if (requestId !== telemetryRequestId || sourceRequestId !== soilSourceRequestId) return;
      set({ telemetryError: 'land.telemetryUnavailable' });
    }
  },

  restoreSoilTelemetry: () => {
    soilSourceRequestId += 1;
    const { telemetrySoilData } = get();
    if (!telemetrySoilData) return;
    set({
      soilData: telemetrySoilData,
      soilOverride: null,
      isMunicipalBaselineActive: false
    });
    get().computeRecommendations();
  },

  setSoilOverride: (override) => {
    const validated = parseFarmerSoilOverride(override);
    if (!validated) return;
    set({ soilOverride: { ...(get().soilOverride || {}), ...validated } });
    get().computeRecommendations();
  },

  resetSoilOverride: () => {
    set({ soilOverride: null });
    get().computeRecommendations();
  },

  setWaterSource: (waterSource) => {
    set({ waterSource });
    get().computeRecommendations();
  },

  setFieldSizeHa: (val) => {
    if (val === null) {
      set({ fieldSizeHa: null });
      return;
    }
    if (typeof val === 'number' && Number.isFinite(val) && val >= 0 && val <= 10000) {
      set({ fieldSizeHa: Number(val.toFixed(2)) });
    }
  },

  setPlotNotes: (notes) => {
    set({ plotNotes: typeof notes === 'string' ? notes.slice(0, 500) : '' });
  },

  setMapExpanded: (open) => set({ isMapExpanded: open }),

  setSavedPlansOpen: (open) => set({ isSavedPlansOpen: open }),

  promotePlan: (planId) => set({ activeSpotlightPlanId: planId }),

  savePlan: (plan, rankIndex) => {
    const current = get();
    const resolvedRankIndex =
      rankIndex ??
      (current.recommendedPlans.findIndex((p) => p.id === plan.id) + 1 || 1);

    const record: SavedPlanRecord = {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `saved_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      savedAtIso: new Date().toISOString(),
      savedAt: Date.now(),
      rankIndex: resolvedRankIndex,
      location: { ...current.selectedLocation },
      waterSource: current.waterSource,
      fieldSizeHa: current.fieldSizeHa,
      plotNotes: current.plotNotes,
      priorities: { ...current.priorities },
      recentCropId: current.recentCropId,
      excludedCropIds: [...current.excludedCropIds],
      soilOverride: current.soilOverride,
      isMunicipalBaselineActive: current.isMunicipalBaselineActive,
      useDemoAssumptions: current.useDemoAssumptions,
      activeScenario: current.activeScenario,
      plan
    };

    const updated = savePlanSnapshot(record);
    set({ savedPlans: updated });
  },

  removeSavedPlan: (savedId) => {
    const updated = deleteSavedPlanSnapshot(savedId);
    set({ savedPlans: updated });
  },

  restoreSavedPlan: (savedId) => {
    const current = get();
    const record = current.savedPlans.find((p) => p.id === savedId);
    if (!record) return;

    const coordsChanged =
      current.selectedLocation.lat !== record.location.lat ||
      current.selectedLocation.lon !== record.location.lon;

    const currentPlans = current.recommendedPlans;
    const hasPlan = currentPlans.some((p) => p.id === record.plan.id);
    const nextPlans = hasPlan ? currentPlans : [record.plan, ...currentPlans];

    set({
      selectedLocation: { ...record.location },
      waterSource: record.waterSource,
      fieldSizeHa: record.fieldSizeHa,
      plotNotes: record.plotNotes,
      priorities: { ...record.priorities },
      recentCropId: record.recentCropId,
      excludedCropIds: [...record.excludedCropIds],
      soilOverride: record.soilOverride,
      isMunicipalBaselineActive: record.isMunicipalBaselineActive,
      useDemoAssumptions: record.useDemoAssumptions,
      activeScenario: record.activeScenario,
      currentStep: 4,
      isSavedPlansOpen: false,
      activeSpotlightPlanId: record.plan.id,
      advisoryIssuedAt: Date.now(),
      recommendedPlans: nextPlans
    });

    if (coordsChanged) {
      void get().fetchTelemetry(record.location.lat, record.location.lon);
    }
  },

  setRecentCropId: (cropId) => {
    set({ recentCropId: cropId });
    get().computeRecommendations();
  },

  toggleCropExclusion: (cropId) => {
    const current = get().excludedCropIds;
    const next = current.includes(cropId)
      ? current.filter((id) => id !== cropId)
      : [...current, cropId];
    set({ excludedCropIds: next });
    get().computeRecommendations();
  },

  setPriority: (key, val) => {
    set({
      priorities: {
        ...get().priorities,
        [key]: val
      }
    });
    get().computeRecommendations();
  },

  computeRecommendations: () => {
    const {
      useDemoAssumptions,
      climateData,
      soilData,
      soilOverride,
      priorities,
      recentCropId,
      excludedCropIds,
      waterSource,
      activeSpotlightPlanId
    } = get();

    if (!climateData || !soilData) {
      set({
        recommendedPlans: [],
        advisoryIssuedAt: null,
        comparedPlanIds: [],
        activeSpotlightPlanId: null
      });
      return;
    }

    const effectiveSoil: SoilData = resolvePlanningSoil(soilData, soilOverride, useDemoAssumptions);

    const plans = generateRotationRecommendations({
      allCrops,
      climate: climateData,
      soil: effectiveSoil,
      priorities,
      recentCropId: recentCropId || undefined,
      excludedCropIds,
      waterSource,
      maxResults: 6
    });

    const nextSpotlight =
      activeSpotlightPlanId && plans.some((p) => p.id === activeSpotlightPlanId)
        ? activeSpotlightPlanId
        : null;

    set({
      recommendedPlans: plans,
      advisoryIssuedAt: plans.length ? Date.now() : null,
      activeSpotlightPlanId: nextSpotlight,
      comparedPlanIds: get().comparedPlanIds.filter((id) => plans.some((plan) => plan.id === id))
    });
  },

  setActiveScenario: (scenario) => set({ activeScenario: scenario }),

  togglePlanComparison: (planId) => {
    const current = get().comparedPlanIds;
    if (current.includes(planId)) {
      set({ comparedPlanIds: current.filter((id) => id !== planId) });
    } else {
      if (current.length >= 3) {
        // limit to 3 max
        set({ comparedPlanIds: [...current.slice(1), planId] });
      } else {
        set({ comparedPlanIds: [...current, planId] });
      }
    }
  }
}));
