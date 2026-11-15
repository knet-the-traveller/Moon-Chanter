export type { LandSummary, LandMetric, MetricProvenance, ClimateMetric, SoilMetric } from './contracts';
import type { ClimateMetric, SoilMetric, MetricProvenance } from './contracts';
import type { SoilModelEvidence } from './soilGridsPackage';

export type Language = 'en' | 'fil';

export interface LocalReviewDescriptor {
  id: string;
  translationKey: string;
  params?: Record<string, string | number>;
}

export interface PilotLocation {
  id: string;
  name: string;
  province: string;
  region: string;
  lat: number;
  lon: number;
  elevationMeters: number;
  description: {
    en: string;
    fil: string;
  };
}

export type SoilTexture = 'clay' | 'clay_loam' | 'loam' | 'sandy_loam' | 'sandy' | 'silt_loam';
export type DrainageClass = 'poor' | 'moderate' | 'well';
export type OrganicMatterLevel = 'low' | 'medium' | 'high' | 'unknown';
export type PhosphorusFixationRisk = 'low' | 'moderate' | 'high';

export interface SoilData {
  /** Native-cell model evidence, distinct from municipal examples and field readings. */
  modelEvidence?: SoilModelEvidence;
  provenance?: Partial<Record<SoilMetric, MetricProvenance>>;
  source: string;
  texture: SoilTexture | null;
  drainage: DrainageClass | null;
  organicMatter: OrganicMatterLevel;
  ph: number | null;
  isEstimate: boolean;
  rawClayPercent?: number;
  rawSandPercent?: number;
  rawSocDgPerKg?: number;
  bulkDensityGcm3?: number;
  phosphorusFixationRisk?: PhosphorusFixationRisk;
  slopePct?: number;
  needsReview?: boolean;
  reviewNote?: string;
}

export type SoilProfile = SoilData;

export interface MonthlyClimatePoint {
  month: string; // e.g. "Jan", "Feb"
  monthNum: number; // 1-12
  temp: number; // T2M (°C)
  tempMax: number; // T2M_MAX (°C)
  tempMin: number | null; // T2M_MIN (°C)
  rainfall: number; // PRECTOTCORR (mm/month)
  solarRadiation: number; // ALLSKY_SFC_SW_DWN (MJ/m^2/day)
  humidity: number; // RH2M (%)
}

export interface ClimateData {
  calendarVersion?: string;
  provenance?: Partial<Record<ClimateMetric, MetricProvenance>>;
  source: string;
  variableList: string[];
  dateRange: string;
  isSampleData: boolean;
  meanAnnualPrecipitation: number; // mm
  meanAnnualTemp: number; // °C
  seasonalStats: {
    wet: { precip: number; avgTemp: number; maxTemp: number };
    dryCool: { precip: number; avgTemp: number; maxTemp: number };
    dryHot: { precip: number; avgTemp: number; maxTemp: number };
  };
  monthly: MonthlyClimatePoint[];
  heatStressDaysPerYear: number;
  drySpellRisk: 'low' | 'moderate' | 'high';
  excessWaterRisk: 'low' | 'moderate' | 'high';
  heatRisk: 'low' | 'moderate' | 'high';
  tenYearRainfallTrend: 'increasing' | 'stable' | 'decreasing';
  trendDeltaPercent: number;
}

export type RootDepth = 'shallow' | 'medium' | 'deep';
export type RelativeTier = 'low' | 'medium' | 'high';
export type SeasonWindow = 'wet' | 'dry_cool' | 'dry_hot';

export interface Crop {
  id: string;
  name: { en: string; local: string };
  family:
    | 'grass'
    | 'legume'
    | 'solanaceae'
    | 'convolvulaceae'
    | 'euphorbiaceae'
    | 'cucurbitaceae'
    | 'malvaceae'
    | 'amaryllidaceae'
    | 'fallow';
  nitrogenFixing: boolean;
  rootDepth: RootDepth;
  waterDemand: RelativeTier;
  droughtTolerance: RelativeTier;
  floodTolerance: RelativeTier;
  heatTolerance: RelativeTier;
  seasonLengthDays: number;
  plantingWindows: SeasonWindow[];
  residueBenefit: RelativeTier;
  laborIntensity: RelativeTier;
  inputCost: RelativeTier;
  marketTier: RelativeTier;
  soilPref: {
    texture: SoilTexture[];
    drainage: DrainageClass[];
    minPh?: number;
    maxPh?: number;
  };
  breakDiseaseFamilies?: string[];
  notes: string;
  sources: string[];
  needsReview?: boolean;
}

export type WaterSource = 'irrigation_canal' | 'rainfed' | 'pump_well' | 'small_pond';

export interface FarmerPriorities {
  soilHealth: number; // 0 - 100
  waterResilience: number; // 0 - 100
  stableIncome: number; // 0 - 100
  lowInputCost: number; // 0 - 100
  lowLabor: number; // 0 - 100
  climateRisk: number; // 0 - 100
}

export interface RotationSeasonStep {
  seasonKey: SeasonWindow;
  seasonName: { en: string; local: string };
  periodMonths: string;
  crop: Crop;
  role: string;
}

export interface PlanScoreBreakdown {
  overall: number; // 0 - 100
  soilHealth: number; // 0 - 100
  waterResilience: number; // 0 - 100
  climateRisk: number; // 0 - 100
  economics: number; // 0 - 100
  labor: number; // 0 - 100
}

export type CanonicalScenarioId = 'baseline' | 'hotter' | 'drier' | 'compound' | 'wetter';
export type ScenarioCondition = CanonicalScenarioId | 'hotterAndDrier' | 'hotter_drier';

export interface PlanReason {
  id: string;
  ruleId: string;
  category: 'soil' | 'water' | 'climate' | 'economics' | 'resilience';
  textEn: string;
  textFil: string;
  dataEvidence: string;
}

export interface PlanRisk {
  id: string;
  ruleId?: string;
  textEn: string;
  textFil: string;
  mitigationEn: string;
  mitigationFil: string;
}

export interface RotationPlan {
  id: string;
  isBaseline?: boolean;
  name: { en: string; local: string };
  seasons: RotationSeasonStep[];
  scores: PlanScoreBreakdown;
  scenarioScores: Record<ScenarioCondition, number>;
  robustness: 'robust' | 'moderate' | 'vulnerable';
  reasons: PlanReason[];
  risks: PlanRisk[];
}
