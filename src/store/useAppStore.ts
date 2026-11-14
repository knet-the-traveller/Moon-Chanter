import { create } from 'zustand';
import type {
  Language,
  ClimateData,
  SoilData,
  FarmerPriorities,
  RotationPlan,
  ScenarioCondition,
  Crop,
  PilotLocation
} from '../types';
import { PILOT_LOCATIONS } from '../data/pilotLocations';
import cropsData from '../data/crops.json';
import { fetchNasaPowerClimate } from '../services/nasaPower';
import { fetchSoilGridsData } from '../services/soilGrids';
import { generateRotationRecommendations } from '../engine';

const allCrops = cropsData as Crop[];

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
  soilOverride: Partial<SoilData> | null;

  // Farmer Inputs & History
  recentCropId: string | null;
  excludedCropIds: string[];
  priorities: FarmerPriorities;

  // Recommendations & Scenarios
  recommendedPlans: RotationPlan[];
  activeScenario: ScenarioCondition;
  comparedPlanIds: string[];

  // Actions
  setLanguage: (lang: Language) => void;
  setCurrentStep: (step: 1 | 2 | 3 | 4) => void;
  setMethodologyModalOpen: (open: boolean) => void;
  setComparisonModalOpen: (open: boolean) => void;
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
  activeScenario: 'baseline',
  comparedPlanIds: [],

  setLanguage: (lang) => set({ language: lang }),
  setCurrentStep: (step) => set({ currentStep: step }),
  setMethodologyModalOpen: (open) => set({ isMethodologyModalOpen: open }),
  setComparisonModalOpen: (open) => set({ isComparisonModalOpen: open }),

  selectPilotPreset: async (pilot) => {
    set({
      selectedLocation: {
        id: pilot.id,
        name: pilot.name,
        province: pilot.province,
        region: pilot.region,
        lat: pilot.lat,
        lon: pilot.lon,
        elevationMeters: pilot.elevationMeters
      },
      soilOverride: null
    });
    await get().fetchTelemetry(pilot.lat, pilot.lon);
  },

  setCustomCoordinates: async (lat, lon, customName) => {
    set({
      selectedLocation: {
        id: undefined,
        name: customName || `Field Point (${lat.toFixed(3)}°, ${lon.toFixed(3)}°)`,
        province: 'Custom Location',
        region: 'Philippines Agro-Zone',
        lat,
        lon,
        elevationMeters: 35
      },
      soilOverride: null
    });
    await get().fetchTelemetry(lat, lon);
  },

  fetchTelemetry: async (lat, lon) => {
    set({ isLoadingTelemetry: true, telemetryError: null });
    try {
      const [climate, soil] = await Promise.all([
        fetchNasaPowerClimate(lat, lon),
        fetchSoilGridsData(lat, lon)
      ]);

      set({
        climateData: climate,
        soilData: soil,
        isLoadingTelemetry: false
      });

      // Automatically recompute recommendations whenever telemetry updates
      get().computeRecommendations();
    } catch (err) {
      console.error('Error fetching telemetry:', err);
      set({
        isLoadingTelemetry: false,
        telemetryError: 'Unable to load live satellite telemetry. Using fallback regional benchmark.'
      });
      get().computeRecommendations();
    }
  },

  setSoilOverride: (override) => {
    set({ soilOverride: { ...(get().soilOverride || {}), ...override } });
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
      return;
    }

    const effectiveSoil: SoilData = {
      ...soilData,
      ...(soilOverride || {})
    };

    const plans = generateRotationRecommendations({
      allCrops,
      climate: climateData,
      soil: effectiveSoil,
      priorities,
      recentCropId: recentCropId || undefined,
      excludedCropIds,
      maxResults: 6
    });

    set({ recommendedPlans: plans });
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
