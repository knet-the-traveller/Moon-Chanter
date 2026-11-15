import type { Crop, ClimateData, SoilData, FarmerPriorities, RotationPlan, WaterSource } from '../types';
import { generateCandidateRotations } from './candidateGenerator';
import { calculateSequenceScores } from './scoring';
import { evaluateScenarios } from './scenarios';
import { generatePlanExplanations } from './explainer';
import { planningPeriod } from '../config/planningCalendar';

export interface RecommendationEngineParams {
  allCrops: Crop[];
  climate: ClimateData;
  soil: SoilData;
  priorities: FarmerPriorities;
  recentCropId?: string;
  excludedCropIds?: string[];
  maxResults?: number;
  waterSource?: WaterSource;
}

export function generateRotationRecommendations(params: RecommendationEngineParams): RotationPlan[] {
  const {
    allCrops,
    climate,
    soil,
    priorities,
    recentCropId,
    excludedCropIds = [],
    maxResults = 6,
    waterSource = 'irrigation_canal'
  } = params;

  // 1. Generate eligible candidate sequences
  const candidates = generateCandidateRotations({
    allCrops,
    soil,
    recentCropId,
    excludedCropIds,
    maxCandidates: 40
  });

  if (candidates.length === 0) {
    return [];
  }

  // 2. Score candidates and evaluate scenarios
  const evaluatedPlans = candidates.map((cand, index) => {
    const scores = calculateSequenceScores(cand, climate, soil, priorities, waterSource);
    const scenarioEval = evaluateScenarios(cand, climate, soil, priorities, undefined, waterSource);
    const explanations = generatePlanExplanations(cand, climate, soil, waterSource);

    const planId = `plan_${cand.s1Crop.id}_${cand.s2Crop.id}_${cand.s3Crop.id}_${index}`;

    const plan: RotationPlan = {
      id: planId,
      name: cand.planName ?? {
        en: `${cand.s1Crop.name.en} → ${cand.s2Crop.name.en} → ${cand.s3Crop.name.en}`,
        local: `${cand.s1Crop.name.local} → ${cand.s2Crop.name.local} → ${cand.s3Crop.name.local}`
      },
      isBaseline: cand.isBaseline,
      seasons: [
        {
          seasonKey: 'wet',
          seasonName: { en: 'Wet Season (Monsoon)', local: 'Tag-ulan (Habagat)' },
          periodMonths: planningPeriod('wet'),
          crop: cand.s1Crop,
          role: cand.s1Crop.id === 'rice' ? 'Staple Cash Crop' : 'Early Monsoon Diversification'
        },
        {
          seasonKey: 'dry_cool',
          seasonName: { en: 'Cool Dry Season', local: 'Malamig na Tag-araw (Amihan)' },
          periodMonths: planningPeriod('coolDry'),
          crop: cand.s2Crop,
          role: cand.s2Crop.nitrogenFixing ? 'Soil Restorative Pulse' : 'Secondary Commercial Harvest'
        },
        {
          seasonKey: 'dry_hot',
          seasonName: { en: 'Hot Dry Season / Catch', local: 'Tag-init / Pangsalag' },
          periodMonths: planningPeriod('hotDry'),
          crop: cand.s3Crop,
          role:
            cand.s3Crop.family === 'fallow'
              ? 'Unplanted Bare Fallow / Stubble Rest'
              : cand.s3Crop.droughtTolerance === 'high'
                ? 'Drought-Hardy Soil Cover'
                : 'Short-Cycle Cash Catch'
        }
      ],
      scores,
      scenarioScores: scenarioEval.scenarioScores,
      robustness: scenarioEval.robustness,
      reasons: explanations.reasons,
      risks: explanations.risks
    };

    return plan;
  });

  // 3. Rank adaptive plans by overall score descending and always retain the pinned baseline for comparison
  const adaptivePlans = evaluatedPlans
    .filter((p) => !p.isBaseline)
    .sort((a, b) => b.scores.overall - a.scores.overall);
  const baselinePlan = evaluatedPlans.find((p) => p.isBaseline);

  if (baselinePlan && maxResults >= 2) {
    return [...adaptivePlans.slice(0, maxResults - 1), baselinePlan];
  }

  return adaptivePlans.slice(0, maxResults);
}

export { evaluateScenarios, applyScenario, summarizeAllScenarios } from './scenarios';
export type { CanonicalScenarioId, ClimateScenarioId, ScenarioEvaluation, ScenarioDeltas } from './scenarios';
