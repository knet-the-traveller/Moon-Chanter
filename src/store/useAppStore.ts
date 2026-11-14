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
  PilotLocation
} from '../types';
import { PILOT_LOCATIONS } from '../data/pilotLocations';
import cropsData from '../data/crops.json';
import { fetchNasaPowerClimate } from '../services/nasaPower';
import { fetchSoilGridsData, applyFarmerSoilOverride, parseFarmerSoilOverride } from '../services/soilGrids';
import { generateRotationRecommendations } from '../engine';
import { fetchLandSummary } from '../services/landSummary';
import { CoordinatesSchema } from '../types/landFixture';
import { getTranslation } from '../i18n';

const allCrops = cropsData as Crop[];
let telemetryRequestId = 0;
let gpsRequestId = 0;
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
  landSummary: LandSummary | null;
  isLoadingLand: boolean;
  landError: string | null;
  isLocatingGps: boolean;
  gpsError: string | null;
  soilOverride: Partial<SoilData> | null;

  // Farmer Inputs & History
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
  setSoilOverride: (override: Partial<SoilData>) => void;
  resetSoilOverride: () => void;
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
  landSummary: null,
  isLoadingLand: false,
  landError: null,
  isLocatingGps: false,
  gpsError: null,
  soilOverride: null,

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
      landSummary: null,
      recommendedPlans: [],
      advisoryIssuedAt: null,
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
    set({
      isLoadingTelemetry: true,
      telemetryError: null,
      isLoadingLand: true,
      landError: null,
      climateData: null,
      soilData: null,
      landSummary: null,
      recommendedPlans: [],
      advisoryIssuedAt: null
    });
    if (!isCurrent()) return;

    const land = fetchLandSummary(lat, lon, controller.signal).then((summary) => {
      if (!isCurrent()) return;
      set({
        landSummary: summary,
        isLoadingLand: false,
        selectedLocation: { ...get().selectedLocation, elevationMeters: summary.elevationM }
      });
    }).catch(() => {
      if (isCurrent()) set({ isLoadingLand: false, landError: 'land.unavailable' });
    });

    const telemetry = Promise.allSettled([
      fetchNasaPowerClimate(lat, lon), fetchSoilGridsData(lat, lon)
    ]).then(([climate, soil]) => {
      if (!isCurrent()) return;
      const failed = climate.status === 'rejected' || soil.status === 'rejected';
      set({
        climateData: climate.status === 'fulfilled' ? climate.value : null,
        soilData: soil.status === 'fulfilled' ? soil.value : null,
        isLoadingTelemetry: false,
        telemetryError: failed ? 'land.telemetryUnavailable' : null
      });
      get().computeRecommendations();
    });

    await Promise.all([land, telemetry]);
    if (isCurrent()) landController = null;
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
    const { climateData, soilData, soilOverride, priorities, recentCropId, excludedCropIds } = get();

    if (!climateData || !soilData) {
      set({ recommendedPlans: [], advisoryIssuedAt: null, comparedPlanIds: [] });
      return;
    }

    const effectiveSoil: SoilData = applyFarmerSoilOverride(soilData, soilOverride);

    const plans = generateRotationRecommendations({
      allCrops,
      climate: climateData,
      soil: effectiveSoil,
      priorities,
      recentCropId: recentCropId || undefined,
      excludedCropIds,
      maxResults: 6
    });

    set({ recommendedPlans: plans, advisoryIssuedAt: plans.length ? Date.now() : null,
      comparedPlanIds: get().comparedPlanIds.filter(id => plans.some(plan => plan.id === id)) });
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
