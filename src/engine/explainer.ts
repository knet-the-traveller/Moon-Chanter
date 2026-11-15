import { getTranslation } from '../i18n';
import type { Language } from '../types';
import type { CandidateSequence } from './candidateGenerator';
import type { ClimateData, PlanReason, PlanRisk, SoilData } from '../types';
import type { RotationPlan, LocalReviewDescriptor, MetricProvenance } from '../types';
import type { PlanDataContext } from '../data/provenance';
import { assertRequiredSoilInputs } from './soilInputs';
import { SOIL_FIT_RULE, assessSoilSuitability } from './soilSuitability';

function scienceText(language: Language, key: string, params: Record<string, string | number> = {}): string {
  return getTranslation(language, `science.${key}`).replace(/\{(\w+)\}/g, (match, name: string) => String(params[name] ?? match));
}

// Presentation descriptors only: explicit context, no clock, network, store, or score changes.
export function generateLocalReviewChecklist(
  plan: Pick<RotationPlan, 'seasons'>, context: PlanDataContext
): LocalReviewDescriptor[] {
  const metadata = [
    ...Object.values(context.climate?.provenance ?? {}),
    ...Object.values(context.soil?.provenance ?? {}),
    ...Object.values(context.land?.provenance ?? {})
  ].filter((entry): entry is MetricProvenance => entry !== undefined);
  const items: LocalReviewDescriptor[] = [];
  const add = (id: string, params?: LocalReviewDescriptor['params']) => items.push({ id, translationKey: `localReview.${id}`, ...(params ? { params } : {}) });
  const references = new Set<string>();
  for (const item of metadata) {
    if (item.isSample && item.sampleLocation) references.add(item.sampleLocation.name);
  }
  if (context.climate?.isSampleData && !Object.values(context.climate.provenance ?? {}).some(item => item?.isSample && item.sampleLocation)) references.add(context.climate.source);
  if (context.soil?.isEstimate && !Object.values(context.soil.provenance ?? {}).some(item => item?.sampleLocation)) references.add(context.soil.source);
  if (context.land?.isSample) references.add(context.land.sampleHub.name);
  if (references.size) add('municipal', { sources: [...references].sort((a,b) => a.localeCompare(b,'en')).join('; ') });
  if (metadata.some(item => item.isSynthetic)) add('synthetic');
  if (metadata.some(item => item.tier === 'cached-live' || item.cached)) add('cached');
  if (metadata.some(item => item.tier === 'farmer')) add('override');
  if (!context.climate || !context.soil || !context.land || !context.climate.provenance || !context.soil.provenance
    || metadata.some(item => !item.spatialResolution || !item.dateRange)) add('unavailable');
  if (!context.land?.ndvi.trendAvailable) add('ndviTrend');
  if (SOIL_FIT_RULE.needsReview || metadata.some(item => item.needsReview) || context.land?.needsReview || context.soil?.needsReview) add('review');
  if (plan.seasons.some(season => season.crop.needsReview)) add('cropReview');
  add('pixelScale');
  add('canalTurnouts');
  add('compaction');
  add('buyerPrices', { crops: plan.seasons.filter(season => season.crop.family !== 'fallow').map(season => season.crop.id).filter((id, index, all) => all.indexOf(id) === index).join(', ') });
  return items;
}

export function generatePlanExplanations(
  seq: CandidateSequence,
  climate: ClimateData,
  soil: SoilData
): { reasons: PlanReason[]; risks: PlanRisk[] } {
  assertRequiredSoilInputs(soil);
  const { s1Crop, s2Crop, s3Crop } = seq;
  const crops = [s1Crop, s2Crop, s3Crop];
  const activeCrops = crops.filter((c) => c.family !== 'fallow');
  const hasFallow = activeCrops.length < crops.length;
  const reasons: PlanReason[] = [];
  const risks: PlanRisk[] = [];

  // [AGRO-RULE-01-NFIX]: Nitrogen Fixation & Short-Cycle Water Savings (Pag-asa Mungbean)
  const legumes = activeCrops.filter((c) => c.nitrogenFixing);
  if (legumes.length > 0) {
    const legumeNamesEn = legumes.map((c) => c.name.en).join(' and ');
    const legumeNamesFil = legumes.map((c) => c.name.local).join(' at ');
    reasons.push({
      id: 'reason_nfix', ruleId: 'AGRO-RULE-01-NFIX', category: 'soil',
      textEn: `${legumeNamesEn} may contribute biological nitrogen fixation. Actual nitrogen supply depends on inoculation, soil, crop growth and residue management; no field nitrogen amount or fertilizer saving is estimated here.`,
      textFil: `Maaaring makatulong ang ${legumeNamesFil} sa pagdagdag ng nitroheno. Nakadepende ito sa inokulasyon, lupa, paglaki at pamamahala ng tira ng pananim; walang tinatayang dami ng nitroheno o matitipid na abono sa bukid.`,
      dataEvidence: 'Crop-catalog legume trait; literature-based comparison, not a field nitrogen measurement.'
    });
  }

  // [AGRO-RULE-02-HEAT35] Historical seasonal peak screen, not observed flowering exposure.
  const hasDrySeasonRice = s2Crop.id === 'rice' || s3Crop.id === 'rice';
  const dryHotMax = climate.seasonalStats.dryHot.maxTemp;
  if (hasDrySeasonRice && dryHotMax > 35.0) {
    risks.push({
      id: 'risk_heat35_rice', ruleId: 'AGRO-RULE-02-HEAT35',
      textEn: `The supplied hot-dry seasonal maximum (${dryHotMax}°C) exceeds the team's 35°C rice heat screen. Damage depends on flowering-time exposure, duration and cultivar; this regional historical peak does not establish field sterility or yield loss.`,
      textFil: `Lampas sa 35°C na paunang pagsusuri ang ibinigay na pinakamataas na temperatura (${dryHotMax}°C) sa mainit na tag-araw. Nakadepende ang pinsala sa aktuwal na init sa pamumulaklak, tagal at barayti; hindi nito pinatutunayan ang pagkabaog o pagkawala ng ani sa bukid.`,
      mitigationEn: 'Discuss planting and flowering dates, water access and alternative crops with a local technician. This screen does not prescribe a crop replacement.',
      mitigationFil: 'Talakayin sa lokal na tekniko ang petsa ng pagtatanim at pamumulaklak, patubig at mga alternatibong pananim. Hindi ito utos na palitan ang pananim.'
    });
  } else if (!seq.isBaseline && !hasDrySeasonRice && dryHotMax > 35.0) {
    reasons.push({
      id: 'reason_heat35_escape', ruleId: 'AGRO-RULE-02-HEAT35', category: 'resilience',
      textEn: `This sequence avoids dry-season rice in the team's heat screen (${dryHotMax}°C seasonal peak, threshold >35°C). It does not guarantee protection from heat or predict yield.`,
      textFil: `Walang palay sa tag-araw ang planong ito sa paunang pagsusuri (${dryHotMax}°C, hangganang >35°C). Hindi nito ginagarantiya ang proteksyon sa init o tinataya ang ani.`,
      dataEvidence: 'Supplied historical seasonal maximum; actual flowering dates and exposure are unavailable.'
    });
  }

  // [AGRO-RULE-03-PESTBREAK]: Continuous Host Pest & Pathogen Break
  const consecutivePairs: Array<[typeof s1Crop, typeof s2Crop]> = [
    [s1Crop, s2Crop],
    [s2Crop, s3Crop]
  ];
  let hasHostConflict = false;

  for (const [prev, next] of consecutivePairs) {
    if (prev.family === 'fallow' || next.family === 'fallow') continue;
    if (prev.id === 'corn' && next.id === 'corn') {
      hasHostConflict = true;
      risks.push({
        id: 'risk_pestbreak_corn',
        ruleId: 'AGRO-RULE-03-PESTBREAK',
        textEn: 'Continuous Corn → Corn monoculture sustains Fall Armyworm (Spodoptera frugiperda) larvae and stalk borer populations across seasons.',
        textFil: 'Ang tuloy-tuloy na Mais → Mais ay nagpaparami ng Fall Armyworm at mga peste sa tangkay.',
        mitigationEn: 'Insert mungbean or kamote between corn cycles to break the Fall Armyworm host bridge.',
        mitigationFil: 'Magsingit ng munggo o kamote sa pagitan ng mais upang maputol ang siklo ng Fall Armyworm.'
      });
    } else if (prev.family === 'solanaceae' && next.family === 'solanaceae') {
      hasHostConflict = true;
      risks.push({
        id: 'risk_pestbreak_solanaceae',
        ruleId: 'AGRO-RULE-03-PESTBREAK',
        textEn: 'Consecutive Solanaceae crops build up soil-borne Bacterial Wilt (Ralstonia solanacearum) inoculum.',
        textFil: 'Ang sunod-sunod na pananim na Solanaceae ay nagpapalala ng sakit na Bacterial Wilt sa lupa.',
        mitigationEn: 'Rotate Solanaceae with rice, corn, or mungbean before replanting eggplant or tomato.',
        mitigationFil: 'Isalit ang palay, mais, o munggo bago muling magtanim ng talong o kamatis.'
      });
    } else if (prev.family === 'amaryllidaceae' && next.family === 'amaryllidaceae') {
      hasHostConflict = true;
      risks.push({
        id: 'risk_pestbreak_onion',
        ruleId: 'AGRO-RULE-03-PESTBREAK',
        textEn: 'Consecutive Onion → Onion (Amaryllidaceae) escalates Purple Blotch (Alternaria porri) and Fusarium basal rot pressure.',
        textFil: 'Ang sunod-sunod na Sibuyas → Sibuyas ay nagpapataas ng panganib ng sakit na Purple Blotch.',
        mitigationEn: 'Alternate dry-cool bulb onion with monsoon lowland rice and pre-rice mungbean.',
        mitigationFil: 'Ipagpalit ang sibuyas sa palay at munggo upang maputol ang sakit sa sibuyas.'
      });
    } else if (prev.id === 'rice' && next.id === 'rice') {
      hasHostConflict = true;
      risks.push({
        id: 'risk_pestbreak_rice',
        ruleId: 'AGRO-RULE-03-PESTBREAK',
        textEn: 'Back-to-back Rice → Rice sustains green leafhopper, stem-borer, and blast pathogen carryover between seasons.',
        textFil: 'Ang sunod-sunod na Palay → Palay ay nagpapatuloy sa pamumugad ng mga peste at sakit sa palayan.',
        mitigationEn: 'Insert short-cycle Pag-asa mungbean or dry-cool bulb onion between wet-season rice cycles.',
        mitigationFil: 'Isingit ang Pag-asa munggo o sibuyas sa tag-araw upang maputol ang siklo ng peste sa palayan.'
      });
    }
  }

  const activeFamilies = activeCrops.map((c) => c.family);
  const uniqueFamilies = new Set(activeFamilies).size;
  if (!hasHostConflict && uniqueFamilies >= 2) {
    reasons.push({
      id: 'reason_pest_break',
      ruleId: 'AGRO-RULE-03-PESTBREAK',
      category: 'resilience',
      textEn: `Rotating ${uniqueFamilies} distinct botanical families (${activeFamilies.join(' → ')}) may reduce continuity of some crop-specific pest hosts. This does not establish local pest absence or eliminate disease risk.`,
      textFil: `Ang pagsasalit ng ${uniqueFamilies} magkakaibang pamilya ng pananim ay maaaring makatulong sa pagbabawas ng tuloy-tuloy na host ng ilang peste. Hindi nito pinatutunayang walang peste o sakit sa bukid.`,
      dataEvidence: `Crop-family comparison only; local pest scouting and cultivar-specific advice remain necessary.`
    });
  }

  // [AGRO-RULE-04-EROSION-ACID]: Upland Erosion (RUSLE), Acidity/Lime, and Lowland Plow-Pan Verification
  // [AGRO-RULE-05-MODEL-SUPPORT] Imported pH does not establish terrain.
  const isSlopingUpland =
    soil.slopePct !== undefined && soil.slopePct > 15;
  const isAcidicOrPFixed = soil.ph < 5.5 || soil.phosphorusFixationRisk === 'high';

  if (isSlopingUpland && hasFallow) {
    risks.push({
      id: 'risk_erosion_acid_fallow',
      ruleId: 'AGRO-RULE-04-EROSION-ACID',
      textEn: `Bare upland fallow leaves sloping soil (${soil.slopePct !== undefined ? `${soil.slopePct}% slope, ` : ''}pH ${soil.ph.toFixed(1)}) exposed to potential slope-related erosion${isAcidicOrPFixed ? ' and possible acidity-related nutrient constraints' : ''}.`,
      textFil: `Ang bakanteng lupa sa matarik na lupain (pH ${soil.ph.toFixed(1)}) ay maaaring maapektuhan ng pagguho dahil sa ulan; walang kinalkulang dami ng pagguho.`,
      mitigationEn: isAcidicOrPFixed
        ? 'Discuss alternatives to bare fallow, such as suitable cover crops, and consult a local technician to verify agricultural lime (CaCO3) application rates.'
        : 'Discuss suitable vegetative cover and verify contour barriers with a local technician.',
      mitigationFil: isAcidicOrPFixed
        ? 'Talakayin ang angkop na panakip na pananim sa bakanteng lupa at ipasuri sa lokal na tekniko ang kailangang apog (agricultural lime / CaCO3).'
        : 'Talakayin ang angkop na panakip na pananim sa bakanteng lupa upang maprotektahan laban sa pagguho ng lupa.'
    });
  } else if (isSlopingUpland && !hasFallow) {
    reasons.push({
      id: 'reason_erosion_armor',
      ruleId: 'AGRO-RULE-04-EROSION-ACID',
      category: 'soil',
      textEn: `Continuous living canopy cover (${activeCrops.map((c) => c.name.en).join(' → ')}) may help limit soil exposure on slopes. Actual cover between crops and erosion rates are not established by this sequence.`,
      textFil: `Ang tuloy-tuloy na takip na pananim (${activeCrops.map((c) => c.name.local).join(' → ')}) ay maaaring makatulong sa pagtakip ng lupa sa dalisdis; hindi nito pinatutunayan ang aktuwal na takip o dami ng pagguho.`,
      dataEvidence: `Upland soil pH ${soil.ph.toFixed(1)}${soil.slopePct !== undefined ? `, slope ${soil.slopePct}%` : ''}, P-fixation: ${soil.phosphorusFixationRisk ?? 'low'}.`
    });
  }

  if (isAcidicOrPFixed) {
    const phTextEn =
      soil.ph < 5.5
        ? `Strongly acidic soil (pH ${soil.ph.toFixed(1)} < 5.5) may signal acidity-related nutrient and rooting constraints. pH alone does not measure aluminum toxicity, phosphorus fixation or nodulation.`
        : `Elevated phosphorus fixation risk at pH ${soil.ph.toFixed(1)} can restrict crop nutrient uptake without balanced organic/phosphate management.`;
    const phTextFil =
      soil.ph < 5.5
        ? `Ang mababang pH (${soil.ph.toFixed(1)} < 5.5) ay nagpapahiwatig ng P-fixation na maaaring magpahina sa ugat ng pananim.`
        : `Ang panganib ng phosphorus fixation (pH ${soil.ph.toFixed(1)}) ay maaaring makabawas sa sustansya ng pananim.`;
    risks.push({
      id: 'risk_acid_lime_verify',
      ruleId: 'AGRO-RULE-04-EROSION-ACID',
      textEn: phTextEn,
      textFil: phTextFil,
      mitigationEn: 'Request a municipal soil test with an agricultural technician to verify agricultural lime (CaCO3) and organic/rock phosphate rates before sowing.',
      mitigationFil: 'Magpasuri ng lupa sa lokal na tekniko upang matiyak ang tamang dami ng apog (CaCO3) bago magtanim.'
    });
  }

  // [AGRO-RULE-05-MODEL-SUPPORT] SoilGrids topsoil prediction is not a compaction test.
  if (!soil.modelEvidence && soil.bulkDensityGcm3 !== undefined && soil.bulkDensityGcm3 > 1.4) {
    risks.push({
      id: 'risk_plow_pan_compaction',
      ruleId: 'AGRO-RULE-04-EROSION-ACID',
      textEn: `Bulk-density reference (${soil.bulkDensityGcm3.toFixed(2)} g/cm³ > 1.4 g/cm³) raises a compaction question for local review; this estimate does not establish a subsoil plow pan.`,
      textFil: `Ang tantiyang sikip ng lupa (${soil.bulkDensityGcm3.toFixed(2)} g/cm³ > 1.4 g/cm³) ay nagpapahiwatig ng matigas na ilalim (plow-pan) na kailangang tiyakin sa bukid.`,
      mitigationEn: 'Verify compaction depth with a field penetrometer or technician before dry-season sowing; incorporate deep-rooting break crops or minimum-tillage furrows.',
      mitigationFil: 'Ipasuri sa tekniko ang lalim ng tigas gamit ang penetrometer bago magtanim; gumamit ng malalim na ugat na pananim o mababaw na tudling (minimum-tillage).'
    });
  }

  // Root Stratification & Water Alignment supporting evidence
  const rootDepths = activeCrops.map((c) => c.rootDepth);
  if (rootDepths.includes('deep') && rootDepths.includes('shallow')) {
    const deepCrop = activeCrops.find((c) => c.rootDepth === 'deep');
    reasons.push({
      id: 'reason_root_depth',
      ruleId: 'AGRO-RULE-02-ROOT-STRAT',
      category: 'resilience',
      textEn: `Deep-rooting ${deepCrop?.name.en} adds a different rooting-depth trait to the sequence. Actual rooting depth, subsoil compaction and access to water or nutrients need field verification.`,
      textFil: `Ang malalim na ugat ng ${deepCrop?.name.local} ay nagdaragdag ng ibang katangian ng lalim ng ugat. Kailangang tiyakin sa bukid ang aktuwal na lalim, siksik na lupa at abot na tubig o sustansya.`,
      dataEvidence: `Texture is classified as ${soil.texture.replace('_', ' ').toUpperCase()}; root diversity does not diagnose or guarantee removal of compaction.`
    });
  }

  if (s3Crop.family !== 'fallow' && (s3Crop.waterDemand === 'low' || s3Crop.droughtTolerance === 'high')) {
    reasons.push({
      id: 'reason_water_fit',
      ruleId: 'AGRO-RULE-03-HYDRO-ALIGN',
      category: 'water',
      textEn: `Planting drought-hardy ${s3Crop.name.en} during Season 3 offers a lower-water-demand comparison for the hot-dry window. Rainfall alone does not establish irrigation supply, soil moisture or crop success.`,
      textFil: `Ang pagtatanim ng matibay sa tagtuyot na ${s3Crop.name.local} sa Ikatlong Panahon ay alternatibong paghahambing para sa tag-araw. Hindi sapat ang ulan lamang upang matiyak ang tubig o tagumpay ng pananim.`,
      dataEvidence: `The supplied climate profile reports precipitation (${climate.seasonalStats.dryHot.precip} mm total) during March–May; crop water-demand class comes from the catalog; a field water balance has not been calculated.`
    });
  }

  // High Biomass Residue
  const residueCrops = activeCrops.filter((c) => c.residueBenefit === 'high');
  if (residueCrops.length > 0 && reasons.length < 6) {
    reasons.push({
      id: 'reason_biomass',
      ruleId: 'AGRO-RULE-05-BIOMASS-MULCH',
      category: 'soil',
      textEn: `High biomass stubble from ${residueCrops.map((c) => c.name.en).join(' & ')} could provide mulch if retained and managed. Actual residue amounts, soil moisture and weed suppression have not been measured.`,
      textFil: `Ang masaganang dami ng natitirang tangkay at dahon mula sa ${residueCrops.map((c) => c.name.local).join(' at ')} ay maaaring gawing panakip sa lupa kung iiwan at pamamahalaan; hindi nasukat ang aktuwal na dami o epekto nito.`,
      dataEvidence: `Supports soil moisture conservation during high evaporative demand periods.`
    });
  }

  // [AGRO-RULE-06-SOIL-FIT] Use the same assessment as scoring; no hidden penalty.
  const fit = assessSoilSuitability(crops, soil);
  const fitText = (language: Language) => scienceText(language, 'soilFit', {
    ph: soil.ph.toFixed(1), drainage: soil.drainage,
    phCrops: fit.phConflicts.map(c => `${language === 'fil' ? c.name.local : c.name.en} (${c.soilPref.minPh}–${c.soilPref.maxPh})`).join(', ') || scienceText(language, 'none'),
    drainageCrops: fit.drainageConflicts.map(c => language === 'fil' ? c.name.local : c.name.en).join(', ') || scienceText(language, 'none'),
    soilPoints: fit.phPenalty, waterPoints: fit.drainagePenalty
  });
  if (fit.phConflicts.length || fit.drainageConflicts.length) {
    risks.push({
      id: 'risk_soil_fit', ruleId: 'AGRO-RULE-06-SOIL-FIT',
      textEn: fitText('en'), textFil: fitText('fil'),
      mitigationEn: scienceText('en', 'soilFitAction'), mitigationFil: scienceText('fil', 'soilFitAction')
    });
  }
  if (fit.phUnassessed.length) {
    risks.push({
      id: 'risk_soil_ph_unassessed', ruleId: 'AGRO-RULE-06-SOIL-FIT',
      textEn: scienceText('en', 'phUnassessed', { crops: fit.phUnassessed.map(crop => crop.name.en).join(', ') }),
      textFil: scienceText('fil', 'phUnassessed', { crops: fit.phUnassessed.map(crop => crop.name.local).join(', ') }),
      mitigationEn: scienceText('en', 'soilFitAction'), mitigationFil: scienceText('fil', 'soilFitAction')
    });
  }
  if (activeCrops.some(crop => crop.id === 'onion')) {
    risks.push({
      id: 'risk_onion_scouting', ruleId: 'AGRO-RULE-03-PESTBREAK',
      textEn: scienceText('en', 'onion'), textFil: scienceText('fil', 'onion'),
      mitigationEn: scienceText('en', 'onionAction'), mitigationFil: scienceText('fil', 'onionAction')
    });
  }

  // RISKS & TRADE-OFFS
  if (s1Crop.id === 'rice' && climate.excessWaterRisk === 'high') {
    risks.push({
      id: 'risk_flood_peak',
      textEn: 'Monsoon flash flooding or typhoon rain in August–September may submerge seedlings if field drainage canals are blocked.',
      textFil: 'Maaaring malubog ang punla kung magkakaroon ng malalakas na bagyo sa Agosto–Setyembre kapag barado ang kanal ng patubig.',
      mitigationEn: 'Ensure clear perimeter drainage ditches and select flood-tolerant submergence rice varieties (e.g. Sub1 / Tubigan lines).',
      mitigationFil: 'Siguraduhing malinis ang mga kanal at gumamit ng binhing Sub1 na kayang mababad sa baha.'
    });
  }

  if (s3Crop.family !== 'fallow' && s3Crop.waterDemand === 'low' && dryHotMax >= 35.0) {
    risks.push({
      id: 'risk_heat_flower',
      textEn: `Extreme peak temperatures (${climate.seasonalStats.dryHot.maxTemp}°C in the supplied climate profile) raise a heat-stress question; actual crop-stage exposure and soil moisture are unknown.`,
      textFil: `Ang matinding init (${climate.seasonalStats.dryHot.maxTemp}°C sa ibinigay na datos) ay maaaring maglagas ng bulaklak kapag tuluyang natuyo ang lupa.`,
      mitigationEn: 'Discuss mulch, water supply and cultivar-specific planting and flowering dates with a local technician.',
      mitigationFil: 'Talakayin sa tekniko ang panakip sa lupa, patubig at petsa ng pagtatanim at pamumulaklak ng napiling barayti.'
    });
  }

  const highLaborCrops = [s1Crop, s2Crop, s3Crop].filter((c) => c.laborIntensity === 'high');
  if (highLaborCrops.length >= 2) {
    risks.push({
      id: 'risk_labor_demand',
      textEn: `High labor intensity required during transition between ${highLaborCrops.map((c) => c.name.en).join(' and ')} (land preparation, trellising, or multiple harvest passes).`,
      textFil: `Mataas na pangangailangan sa manggagawa sa pag-aani at paghahanda ng lupa sa pagitan ng mga pananim.`,
      mitigationEn: 'Coordinate labor sharing (bayanihan) or stagger planting across field plots to spread peak workloads.',
      mitigationFil: 'Magplano ng tulong-tulong (bayanihan) o magtanim nang pira-piraso upang hindi sabay-sabay ang anihan.'
    });
  }

  return { reasons, risks };
}
