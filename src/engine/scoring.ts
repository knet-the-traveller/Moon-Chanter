import type { CandidateSequence } from './candidateGenerator';
import type { ClimateData, FarmerPriorities, PlanScoreBreakdown, SoilData } from '../types';
import { assertRequiredSoilInputs } from './soilInputs';

export function calculateSequenceScores(
  seq: CandidateSequence,
  climate: ClimateData,
  soil: SoilData,
  priorities: FarmerPriorities
): PlanScoreBreakdown {
  assertRequiredSoilInputs(soil);
  const { s1Crop, s2Crop, s3Crop } = seq;
  const crops = [s1Crop, s2Crop, s3Crop];
  const activeCrops = crops.filter((c) => c.family !== 'fallow');
  const hasFallow = activeCrops.length < crops.length;
  // [AGRO-RULE-05-MODEL-SUPPORT] Imported pH does not establish terrain.
  const isSlopingUpland =
    (soil.slopePct !== undefined && soil.slopePct > 15) ||
    (!soil.modelEvidence && soil.slopePct === undefined && soil.ph < 5.5 && soil.drainage !== 'poor');
  const isAcidicOrPFixed = soil.ph < 5.5 || soil.phosphorusFixationRisk === 'high';
  const hasDrySeasonRice = s2Crop.id === 'rice' || s3Crop.id === 'rice';
  const hasHeatSterility = hasDrySeasonRice && climate.seasonalStats.dryHot.maxTemp > 35.0;

  // 1. SOIL HEALTH SCORE (0 - 100)
  let soilScore = 30; // base score

  // [AGRO-RULE-01-NFIX] Legume & Biological Nitrogen Fixation (+35 to 80 kg N/ha)
  const legumeCount = activeCrops.filter((c) => c.nitrogenFixing).length;
  if (legumeCount >= 2) soilScore += 35;
  else if (legumeCount === 1) soilScore += 25;

  // Root Depth Diversity (shallow, medium, deep) across planted crops
  const rootDepths = new Set(activeCrops.map((c) => c.rootDepth));
  if (rootDepths.size >= 3) soilScore += 20;
  else if (rootDepths.size === 2) soilScore += 12;

  // [AGRO-RULE-05-MODEL-SUPPORT] Imported 0–15 cm density cannot diagnose a subsoil plow pan.
  // Deep root bonus in clay or compacted soils (> 1.4 g/cm3 plow-pan)
  const isCompacted = !soil.modelEvidence && soil.bulkDensityGcm3 !== undefined && soil.bulkDensityGcm3 > 1.4;
  if ((soil.texture === 'clay' || isCompacted) && (rootDepths.has('deep') || rootDepths.has('medium'))) {
    soilScore += 8;
  }
  if (isCompacted && s1Crop.id === 'rice' && s2Crop.id === 'rice') {
    soilScore -= 8;
  }

  // Depleted Organic Matter boost when planting high residue / legume
  if (soil.organicMatter === 'low' && (legumeCount > 0 || activeCrops.some((c) => c.residueBenefit === 'high'))) {
    soilScore += 10;
  }

  // Residue / Biomass Contribution
  const highResidueCount = activeCrops.filter((c) => c.residueBenefit === 'high').length;
  soilScore += highResidueCount * 8;

  // [AGRO-RULE-03-PESTBREAK] Botanical Family Diversity & Host-Break Guardrails
  const activeFamilyCount = new Set(activeCrops.map((c) => c.family)).size;
  if (activeFamilyCount === 3) soilScore += 15;
  else if (activeFamilyCount === 2) soilScore += 8;
  else if (activeFamilyCount <= 1) soilScore -= 12;

  const pairs: Array<[typeof s1Crop, typeof s2Crop]> = [
    [s1Crop, s2Crop],
    [s2Crop, s3Crop]
  ];
  let hasSevereHostConflict = false;
  for (const [prev, next] of pairs) {
    if (prev.family === 'fallow' || next.family === 'fallow') continue;
    if (prev.id === 'corn' && next.id === 'corn') {
      soilScore -= 22; // Fall Armyworm continuity
      hasSevereHostConflict = true;
    }
    if (prev.family === 'solanaceae' && next.family === 'solanaceae') {
      soilScore -= 28; // Bacterial Wilt
      hasSevereHostConflict = true;
    }
    if (prev.family === 'amaryllidaceae' && next.family === 'amaryllidaceae') {
      soilScore -= 24; // Purple Blotch
      hasSevereHostConflict = true;
    }
    if (prev.id === 'rice' && next.id === 'rice') {
      soilScore -= 10; // Rice stem-borer / blast host
      hasSevereHostConflict = true;
    }
  }

  // [AGRO-RULE-04-EROSION-ACID] Upland RUSLE canopy cover vs bare fallow & acid P-fixation stress
  if (isSlopingUpland) {
    if (hasFallow) {
      soilScore -= 24;
    } else if (
      activeCrops.some((c) => c.id === 'mungbean' || c.id === 'sweet_potato' || c.nitrogenFixing)
    ) {
      soilScore += 14;
    }
  } else if (isAcidicOrPFixed && hasFallow) {
    soilScore -= 8;
  }

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
  if (s2Crop.id === 'rice') {
    waterScore -= 18; // Dry-season paddy demands > 1,000 mm
  } else if (s2Crop.waterDemand === 'low' || s2Crop.waterDemand === 'medium') {
    waterScore += 15;
  }

  // [AGRO-RULE-01-NFIX] Short-cycle Pag-asa mungbean water savings (300-350 mm vs >1,000 mm rice)
  if (s2Crop.id === 'mungbean' || s3Crop.id === 'mungbean') {
    waterScore += 8;
  }

  // Season 3 (Hot Dry - minimal rain & dry spell danger)
  if (s3Crop.family === 'fallow') {
    if (isSlopingUpland) waterScore -= 12; // unarmored slope runoff
  } else {
    if (s3Crop.droughtTolerance === 'high') waterScore += 25;
    else if (s3Crop.droughtTolerance === 'medium') waterScore += 10;
    else waterScore -= 20;

    if (s3Crop.waterDemand === 'low') waterScore += 15;
    else if (s3Crop.waterDemand === 'high') waterScore -= 15;
  }

  waterScore = Math.min(100, Math.max(10, waterScore));

  // 3. CLIMATE RISK SCORE (0 - 100)
  let climateScore = 45;

  // [AGRO-RULE-02-HEAT35] Dry-season rice spikelet sterility cliff (> 35°C Apr-May)
  if (hasHeatSterility) {
    const excessC = climate.seasonalStats.dryHot.maxTemp - 35.0;
    climateScore -= Math.round(28 + excessC * 10);
  } else if (climate.seasonalStats.dryHot.maxTemp >= 34.0 && s3Crop.family !== 'fallow') {
    if (s3Crop.heatTolerance === 'high') climateScore += 22;
    else if (s3Crop.heatTolerance === 'medium') climateScore += 10;
    else climateScore -= 20;
  }

  // [AGRO-RULE-03-PESTBREAK] Pest resilience under climate pressure
  if (hasSevereHostConflict) {
    climateScore -= 10;
  } else if (activeFamilyCount === 3) {
    climateScore += 6;
  }

  // Extreme rainfall and typhoon resistance in S1
  if (climate.excessWaterRisk === 'high' && s1Crop.floodTolerance === 'high') {
    climateScore += 20;
  }

  // Dry spell risk protection across active crops
  if (climate.drySpellRisk === 'high') {
    const droughtHardyCount = activeCrops.filter((c) => c.droughtTolerance === 'high').length;
    climateScore += droughtHardyCount * 8;
  }

  climateScore = Math.min(100, Math.max(10, climateScore));

  // 4. ECONOMICS SCORE (0 - 100)
  let econScore = 45;

  // Market value tier across cultivated crops
  const highMarketCount = activeCrops.filter((c) => c.marketTier === 'high').length;
  econScore += highMarketCount * 14;

  // Input cost burden (exclude fallow from cultivation low-input credit; penalize lost fallow harvest)
  const highInputCount = activeCrops.filter((c) => c.inputCost === 'high').length;
  const lowInputCount = activeCrops.filter((c) => c.inputCost === 'low').length;
  econScore -= highInputCount * 8;
  econScore += lowInputCount * 8;
  if (hasFallow) econScore -= 12;

  // [AGRO-RULE-01-NFIX] Synthetic N-fertilizer savings from biological fixation
  if (legumeCount > 0) econScore += 8;
  if (activeCrops.some((c) => c.id === 'mungbean')) econScore += 4;

  // [AGRO-RULE-02-HEAT35] Spikelet sterility revenue loss penalty (7-10% yield loss per 1°C > 35°C)
  if (hasHeatSterility) {
    const excessC = climate.seasonalStats.dryHot.maxTemp - 35.0;
    econScore -= Math.round(14 + excessC * 8);
  }

  // [AGRO-RULE-03-PESTBREAK] Pest & pathogen outbreak cost penalty
  if (hasSevereHostConflict) {
    econScore -= 10;
  }

  // Staple security (presence of rice or corn provides food security)
  const hasStaple = activeCrops.some((c) => c.id === 'rice' || c.id === 'corn');
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
