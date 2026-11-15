import { z } from 'zod';
import type { RotationPlan } from '../types';

export const SAVED_PLANS_STORAGE_KEY = 'anitala_saved_plans_v1';

export const WaterSourceSchema = z.enum([
  'irrigation_canal',
  'rainfed',
  'pump_well',
  'small_pond'
]);

export const SavedPlanCropSchema = z.object({
  id: z.string(),
  name: z.object({ en: z.string(), local: z.string() }),
  family: z.enum([
    'grass',
    'legume',
    'solanaceae',
    'convolvulaceae',
    'euphorbiaceae',
    'cucurbitaceae',
    'malvaceae',
    'amaryllidaceae',
    'fallow'
  ]),
  nitrogenFixing: z.boolean(),
  rootDepth: z.enum(['shallow', 'medium', 'deep']),
  waterDemand: z.enum(['low', 'medium', 'high']),
  droughtTolerance: z.enum(['low', 'medium', 'high']),
  floodTolerance: z.enum(['low', 'medium', 'high']),
  heatTolerance: z.enum(['low', 'medium', 'high']),
  seasonLengthDays: z.number(),
  plantingWindows: z.array(z.enum(['wet', 'dry_cool', 'dry_hot'])),
  residueBenefit: z.enum(['low', 'medium', 'high']),
  laborIntensity: z.enum(['low', 'medium', 'high']),
  inputCost: z.enum(['low', 'medium', 'high']),
  marketTier: z.enum(['low', 'medium', 'high']),
  soilPref: z.object({
    texture: z.array(z.enum(['clay', 'clay_loam', 'loam', 'sandy_loam', 'sandy', 'silt_loam'])),
    drainage: z.array(z.enum(['poor', 'moderate', 'well'])),
    minPh: z.number().optional(),
    maxPh: z.number().optional()
  }),
  breakDiseaseFamilies: z.array(z.string()).optional(),
  notes: z.string(),
  sources: z.array(z.string()),
  needsReview: z.boolean().optional()
}).passthrough();

export const SavedPlanSeasonSchema = z.object({
  seasonKey: z.enum(['wet', 'dry_cool', 'dry_hot']),
  seasonName: z.object({ en: z.string(), local: z.string() }),
  periodMonths: z.string(),
  crop: SavedPlanCropSchema,
  role: z.string()
});

export const SavedPlanReasonSchema = z.object({
  id: z.string(),
  ruleId: z.string(),
  category: z.enum(['soil', 'water', 'climate', 'economics', 'resilience']),
  textEn: z.string(),
  textFil: z.string(),
  dataEvidence: z.string()
});

export const SavedPlanRiskSchema = z.object({
  id: z.string(),
  ruleId: z.string().optional(),
  textEn: z.string(),
  textFil: z.string(),
  mitigationEn: z.string(),
  mitigationFil: z.string()
});

export const SavedPlanScoreBreakdownSchema = z.object({
  overall: z.number(),
  soilHealth: z.number(),
  waterResilience: z.number(),
  climateRisk: z.number(),
  economics: z.number(),
  labor: z.number()
});

export const SavedPlanSnapshotSchema = z.object({
  id: z.string(),
  isBaseline: z.boolean().optional(),
  name: z.object({ en: z.string(), local: z.string() }),
  seasons: z.array(SavedPlanSeasonSchema),
  scores: SavedPlanScoreBreakdownSchema,
  scenarioScores: z.record(z.string(), z.number()),
  robustness: z.enum(['robust', 'moderate', 'vulnerable']),
  reasons: z.array(SavedPlanReasonSchema),
  risks: z.array(SavedPlanRiskSchema)
}) as z.ZodType<RotationPlan>;

export const SoilOverrideSchema = z.object({
  texture: z.enum(['clay', 'clay_loam', 'loam', 'sandy_loam', 'sandy', 'silt_loam']).nullable().optional(),
  drainage: z.enum(['poor', 'moderate', 'well']).nullable().optional(),
  organicMatter: z.enum(['low', 'medium', 'high', 'unknown']).optional(),
  ph: z.number().nullable().optional(),
  rawClayPercent: z.number().optional(),
  rawSandPercent: z.number().optional(),
  rawSocDgPerKg: z.number().optional(),
  bulkDensityGcm3: z.number().optional(),
  phosphorusFixationRisk: z.enum(['low', 'moderate', 'high']).optional(),
  slopePct: z.number().optional(),
  needsReview: z.boolean().optional(),
  reviewNote: z.string().optional()
}).passthrough().nullable();

export const SavedPlanRecordSchema = z.object({
  id: z.string(),
  savedAtIso: z.string(),
  savedAt: z.number().optional(),
  rankIndex: z.number().optional(),
  location: z.object({
    id: z.string().optional(),
    name: z.string(),
    province: z.string(),
    region: z.string(),
    lat: z.number(),
    lon: z.number(),
    elevationMeters: z.number()
  }),
  waterSource: WaterSourceSchema,
  fieldSizeHa: z.number().nullable(),
  plotNotes: z.string(),
  priorities: z.object({
    soilHealth: z.number(),
    waterResilience: z.number(),
    stableIncome: z.number(),
    lowInputCost: z.number(),
    lowLabor: z.number(),
    climateRisk: z.number()
  }),
  recentCropId: z.string().nullable(),
  excludedCropIds: z.array(z.string()),
  soilOverride: SoilOverrideSchema.nullable(),
  isMunicipalBaselineActive: z.boolean(),
  useDemoAssumptions: z.boolean(),
  activeScenario: z.enum([
    'baseline',
    'hotter',
    'drier',
    'compound',
    'wetter',
    'hotterAndDrier',
    'hotter_drier'
  ]),
  plan: SavedPlanSnapshotSchema
});

export type SavedPlanRecord = z.infer<typeof SavedPlanRecordSchema>;

export function loadSavedPlans(): SavedPlanRecord[] {
  if (typeof globalThis.localStorage === 'undefined') {
    return [];
  }
  try {
    const raw = globalThis.localStorage.getItem(SAVED_PLANS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const validRecords: SavedPlanRecord[] = [];
    for (const item of parsed) {
      const res = SavedPlanRecordSchema.safeParse(item);
      if (res.success) {
        validRecords.push(res.data);
      }
    }
    return validRecords;
  } catch {
    return [];
  }
}

export function savePlanSnapshot(record: SavedPlanRecord): SavedPlanRecord[] {
  const current = loadSavedPlans();
  const filtered = current.filter(
    (item) =>
      !(
        item.plan.id === record.plan.id &&
        item.location.lat === record.location.lat &&
        item.location.lon === record.location.lon &&
        item.waterSource === record.waterSource
      )
  );
  const updated = [record, ...filtered].slice(0, 20);
  if (typeof globalThis.localStorage !== 'undefined') {
    try {
      globalThis.localStorage.setItem(SAVED_PLANS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // safe fallback if storage is full or disabled
    }
  }
  return updated;
}

export function deleteSavedPlanSnapshot(id: string): SavedPlanRecord[] {
  const current = loadSavedPlans();
  const updated = current.filter((item) => item.id !== id);
  if (typeof globalThis.localStorage !== 'undefined') {
    try {
      globalThis.localStorage.setItem(SAVED_PLANS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // safe fallback if storage is full or disabled
    }
  }
  return updated;
}
