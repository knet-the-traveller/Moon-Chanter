import type { CandidateSequence } from './candidateGenerator';
import type { ClimateData, FarmerPriorities, PlanScoreBreakdown, SoilData } from '../types';

export function calculateSequenceScores(
  seq: CandidateSequence,
  climate: ClimateData,
  soil: SoilData,
  priorities: FarmerPriorities
): PlanScoreBreakdown {
  const { s1Crop, s2Crop, s3Crop } = seq;
  const crops = [s1Crop, s2Crop, s3Crop];

  // 1. SOIL HEALTH SCORE (0 - 100)
  let soilScore = 30; // base score

  // Legume & Nitrogen Fixation
  const legumeCount = crops.filter((c) => c.nitrogenFixing).length;
  if (legumeCount >= 2) soilScore += 35;
  else if (legumeCount === 1) soilScore += 25;

  // Root Depth Diversity (shallow, medium, deep)
  const rootDepths = new Set(crops.map((c) => c.rootDepth));
  if (rootDepths.size >= 3) soilScore += 20;
  else if (rootDepths.size === 2) soilScore += 12;

  // Deep root bonus in clay soils to break hardpan
  if (soil.texture === 'clay' && rootDepths.has('deep')) {
    soilScore += 8;
  }

  // Depleted Organic Matter boost when planting high residue / legume
  if (soil.organicMatter === 'low' && (legumeCount > 0 || crops.some((c) => c.residueBenefit === 'high'))) {
    soilScore += 10;
  }

  // Residue / Biomass Contribution
  const highResidueCount = crops.filter((c) => c.residueBenefit === 'high').length;
  soilScore += highResidueCount * 8;

  // Botanical Family Diversity (Pest & Pathogen Break)
  const familyCount = new Set(crops.map((c) => c.family)).size;
  if (familyCount === 3) soilScore += 15;
  else if (familyCount === 2) soilScore += 8;

  soilScore = Math.min(100, Math.max(10, soilScore));

  // 2. WATER RESILIENCE SCORE (0 - 100)
  let waterScore = 40;

  // Season 1 (Wet Season - high rainfall)
  if (climate.seasonalStats.wet.precip > 1000) {
    if (s1Crop.floodTolerance === 'high') waterScore += 25;
    else if (s1Crop.floodTolerance === 'medium') waterScore += 12;
    else waterScore -= 15; // easily waterlogged
  }

  // Season 2 (Cool Dry)
  if (s2Crop.waterDemand === 'low' || s2Crop.waterDemand === 'medium') {
    waterScore += 15;
  }

  // Season 3 (Hot Dry - minimal rain & dry spell danger)
  if (s3Crop.droughtTolerance === 'high') waterScore += 25;
  else if (s3Crop.droughtTolerance === 'medium') waterScore += 10;
  else waterScore -= 20;

  if (s3Crop.waterDemand === 'low') waterScore += 15;
  else if (s3Crop.waterDemand === 'high') waterScore -= 15;

  waterScore = Math.min(100, Math.max(10, waterScore));

  // 3. CLIMATE RISK SCORE (0 - 100)
  let climateScore = 40;

  // Heat stress mitigation in Hot Dry season (Apr - May)
  if (climate.seasonalStats.dryHot.maxTemp >= 34.0) {
    if (s3Crop.heatTolerance === 'high') climateScore += 25;
    else if (s3Crop.heatTolerance === 'medium') climateScore += 10;
    else climateScore -= 20;
  }

  // Extreme rainfall and typhoon resistance in S1
  if (climate.excessWaterRisk === 'high' && s1Crop.floodTolerance === 'high') {
    climateScore += 20;
  }

  // Dry spell risk protection
  if (climate.drySpellRisk === 'high') {
    const droughtHardyCount = crops.filter((c) => c.droughtTolerance === 'high').length;
    climateScore += droughtHardyCount * 8;
  }

  climateScore = Math.min(100, Math.max(10, climateScore));

  // 4. ECONOMICS SCORE (0 - 100)
  let econScore = 45;

  // Market value tier
  const highMarketCount = crops.filter((c) => c.marketTier === 'high').length;
  econScore += highMarketCount * 14;

  // Input cost burden
  const highInputCount = crops.filter((c) => c.inputCost === 'high').length;
  const lowInputCount = crops.filter((c) => c.inputCost === 'low').length;
  econScore -= highInputCount * 8;
  econScore += lowInputCount * 8;

  // Staple security (presence of rice or corn provides food security)
  const hasStaple = crops.some((c) => c.id === 'rice' || c.id === 'corn');
  if (hasStaple) econScore += 10;

  econScore = Math.min(100, Math.max(10, econScore));

  // 5. LABOR FEASIBILITY SCORE (0 - 100)
  let laborScore = 50;
  const highLaborCount = crops.filter((c) => c.laborIntensity === 'high').length;
  const lowLaborCount = crops.filter((c) => c.laborIntensity === 'low').length;

  laborScore -= highLaborCount * 12;
  laborScore += lowLaborCount * 14;

  laborScore = Math.min(100, Math.max(10, laborScore));

  // WEIGHTED OVERALL SCORE
  const wSoil = priorities.soilHealth;
  const wWater = priorities.waterResilience;
  const wClimate = priorities.climateRisk;
  const wEcon = priorities.stableIncome;
  const wCost = priorities.lowInputCost;
  const wLabor = priorities.lowLabor;

  const totalWeight = wSoil + wWater + wClimate + wEcon + wCost + wLabor || 1;

  // Combine economic return and low input cost into econ component
  const compositeEcon = (wEcon * econScore + wCost * (100 - (highInputCount * 25))) / ((wEcon + wCost) || 1);

  const weightedSum =
    soilScore * wSoil +
    waterScore * wWater +
    climateScore * wClimate +
    compositeEcon * (wEcon + wCost) +
    laborScore * wLabor;

  const overall = Math.round(weightedSum / totalWeight);

  return {
    overall: Math.min(100, Math.max(10, overall)),
    soilHealth: Math.round(soilScore),
    waterResilience: Math.round(waterScore),
    climateRisk: Math.round(climateScore),
    economics: Math.round(econScore),
    labor: Math.round(laborScore)
  };
}
