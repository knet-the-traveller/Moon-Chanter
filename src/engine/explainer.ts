import type { CandidateSequence } from './candidateGenerator';
import type { ClimateData, PlanReason, PlanRisk, SoilData, WaterSource } from '../types';
import type { RotationPlan, LocalReviewDescriptor, MetricProvenance } from '../types';
import type { PlanDataContext } from '../data/provenance';
import { assertRequiredSoilInputs } from './soilInputs';

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
  if (metadata.some(item => item.needsReview) || context.land?.needsReview || context.soil?.needsReview) add('review');
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
  soil: SoilData,
  waterSource: WaterSource = 'irrigation_canal'
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
    const hasMungbean = legumes.some((c) => c.id === 'mungbean');
    reasons.push({
      id: 'reason_nfix',
      ruleId: 'AGRO-RULE-01-NFIX',
      category: 'soil',
      textEn: hasMungbean
        ? `Incorporating Rhizobium-inoculated ${legumeNamesEn} fixes 35–80 kg N/ha in a fast 60–65 day cycle while needing only 300–350 mm water (vs. >1,000 mm for dry-season rice), cutting synthetic urea inputs.`
        : `Incorporating ${legumeNamesEn} naturally fixes 35–80 kg N/ha of atmospheric nitrogen while needing 300–350 mm residual moisture rather than >1,000 mm paddy irrigation.`,
      textFil: hasMungbean
        ? `Ang Rhizobium-inoculated na ${legumeNamesFil} ay nagbabalik ng 35–80 kg N/ha sa loob lamang ng 60–65 araw gamit ang 300–350 mm na tubig kumpara sa >1,000 mm ng palay.`
        : `Ang pagtatanim ng ${legumeNamesFil} ay nagbabalik ng 35–80 kg N/ha at tipid sa tubig (300–350 mm) kaya bumababa ang gastos sa abono.`,
      dataEvidence: hasMungbean
        ? `Pag-asa legume Rhizobium N-fixation (+35–80 kg N/ha, 60–65d); Soil OM is ${soil.organicMatter.toUpperCase()} (SOC ${soil.rawSocDgPerKg ? (soil.rawSocDgPerKg / 100).toFixed(2) + '%' : 'baseline'}).`
        : `${legumeNamesEn} biological Rhizobium N-fixation (+35–80 kg N/ha); Soil OM is ${soil.organicMatter.toUpperCase()} (SOC ${soil.rawSocDgPerKg ? (soil.rawSocDgPerKg / 100).toFixed(2) + '%' : 'baseline'}).`
    });
  }

  // [AGRO-RULE-02-HEAT35]: Dry-Season Rice Heat Sterility (> 35°C April 10 - May 30)
  const hasDrySeasonRice = s2Crop.id === 'rice' || s3Crop.id === 'rice';
  const dryHotMax = climate.seasonalStats.dryHot.maxTemp;
  if (hasDrySeasonRice && dryHotMax > 35.0) {
    risks.push({
      id: 'risk_heat35_rice',
      ruleId: 'AGRO-RULE-02-HEAT35',
      textEn: `Dry-season rice flowering between April 10 and May 30 faces NASA POWER dryHot Tmax of ${dryHotMax}°C (>35°C threshold), driving a 7%–10% yield loss per 1°C from heat-induced spikelet sterility.`,
      textFil: `Ang pamumulaklak ng palay sa Abril 10–Mayo 30 sa ilalim ng ${dryHotMax}°C (>35°C) ay nagdudulot ng 7%–10% pagkalugi kada 1°C dahil sa pagkabaog ng uhay.`,
      mitigationEn: 'Replace Season 2/3 flooded rice with short-cycle Pag-asa mungbean, bulb onion, or heat-tolerant dry yellow corn, and confirm planting dates with a municipal agriculturist.',
      mitigationFil: 'Palitan ang tag-init na palay ng Pag-asa munggo, sibuyas, o mais upang makaiwas sa >35°C na init at magpakonsulta sa lokal na tekniko.'
    });
  } else if (!seq.isBaseline && !hasDrySeasonRice && dryHotMax > 35.0) {
    reasons.push({
      id: 'reason_heat35_escape',
      ruleId: 'AGRO-RULE-02-HEAT35',
      category: 'resilience',
      textEn: `Avoiding dry-season rice in April–May prevents spikelet sterility losses (7%–10% per 1°C above 35°C) under ${dryHotMax}°C peak temperatures.`,
      textFil: `Ang pag-iwas sa tag-init na palay tuwing Abril–Mayo ay pumipigil sa pagkalugi dulot ng ${dryHotMax}°C (>35°C) na init.`,
      dataEvidence: `NASA POWER dryHot Tmax is ${dryHotMax}°C (>35°C sterility threshold).`
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
      textEn: `Rotating ${uniqueFamilies} distinct botanical families (${activeFamilies.join(' → ')}) interrupts Fall Armyworm (Corn → Corn), Bacterial Wilt (Solanaceae), and Purple Blotch (Onion) host cycles.`,
      textFil: `Ang pagsasalit ng ${uniqueFamilies} magkakaibang pamilya ng pananim ay pumiputol sa siklo ng Fall Armyworm, Bacterial Wilt, at Purple Blotch.`,
      dataEvidence: `Non-consecutive botanical families across planted seasons prevent pest carry-over without heavy pesticide escalation.`
    });
  }

  // [AGRO-RULE-04-EROSION-ACID]: Upland Erosion (RUSLE), Acidity/Lime, and Lowland Plow-Pan Verification
  // [AGRO-RULE-05-MODEL-SUPPORT] Imported pH does not establish terrain.
  const isSlopingUpland =
    (soil.slopePct !== undefined && soil.slopePct > 15) ||
    (!soil.modelEvidence && soil.slopePct === undefined && soil.ph < 5.5 && soil.drainage !== 'poor');
  const isAcidicOrPFixed = soil.ph < 5.5 || soil.phosphorusFixationRisk === 'high';

  if (isSlopingUpland && hasFallow) {
    risks.push({
      id: 'risk_erosion_acid_fallow',
      ruleId: 'AGRO-RULE-04-EROSION-ACID',
      textEn: `Bare upland fallow leaves sloping soil (${soil.slopePct !== undefined ? `${soil.slopePct}% slope, ` : ''}pH ${soil.ph.toFixed(1)}) exposed to high RUSLE soil erosion (C → 1.0)${isAcidicOrPFixed ? ' and severe acidic P-fixation loss' : ''}.`,
      textFil: `Ang bakanteng lupa sa matarik na lupain (pH ${soil.ph.toFixed(1)}) ay madaling maanod ng ulan (RUSLE C → 1.0).`,
      mitigationEn: isAcidicOrPFixed
        ? 'Replace bare fallow with continuous mungbean or sweet potato cover and consult a local technician to verify agricultural lime (CaCO3) application rates.'
        : 'Replace bare fallow with continuous mungbean or sweet potato vegetative canopy cover and verify contour barriers with a local technician.',
      mitigationFil: isAcidicOrPFixed
        ? 'Palitan ng munggo o kamote ang bakanteng lupa at ipasuri sa lokal na tekniko ang kailangang apog (agricultural lime / CaCO3).'
        : 'Palitan ng munggo o kamote ang bakanteng lupa upang maprotektahan laban sa pagguho ng lupa.'
    });
  } else if (isSlopingUpland && !hasFallow) {
    reasons.push({
      id: 'reason_erosion_armor',
      ruleId: 'AGRO-RULE-04-EROSION-ACID',
      category: 'soil',
      textEn: `Continuous living canopy cover (${activeCrops.map((c) => c.name.en).join(' → ')}) armors sloping uplands against RUSLE storm erosion (C → 1.0 on bare soil).`,
      textFil: `Ang tuloy-tuloy na takip na pananim (${activeCrops.map((c) => c.name.local).join(' → ')}) ay pumipigil sa pagguho ng lupa sa dalisdis.`,
      dataEvidence: `Upland soil pH ${soil.ph.toFixed(1)}${soil.slopePct !== undefined ? `, slope ${soil.slopePct}%` : ''}, P-fixation: ${soil.phosphorusFixationRisk ?? 'low'}.`
    });
  }

  if (isAcidicOrPFixed) {
    const phTextEn =
      soil.ph < 5.5
        ? `Strongly acidic soil (pH ${soil.ph.toFixed(1)} < 5.5) indicates high aluminum/iron phosphorus fixation risk that limits legume nodulation and rooting.`
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
      textEn: `Subsoil bulk density estimate (${soil.bulkDensityGcm3.toFixed(2)} g/cm³ > 1.4 g/cm³) flags likely lowland clay plow-pan compaction that can restrict post-rice root penetration.`,
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
      textEn: `Deep-rooting ${deepCrop?.name.en} aerates the subsoil, breaks up plow pans, and pulls up deep moisture and micronutrients that shallow-rooted crops cannot reach.`,
      textFil: `Ang malalim na ugat ng ${deepCrop?.name.local} ay nagbubungkal sa matigas na ilalim ng lupa at humihigop ng sustansya at tubig mula sa ilalim na hindi abot ng ibang pananim.`,
      dataEvidence: `Texture is classified as ${soil.texture.replace('_', ' ').toUpperCase()}; multi-level rooting prevents hardpan formation under heavy agricultural equipment.`
    });
  }

  if (s3Crop.family !== 'fallow' && (s3Crop.waterDemand === 'low' || s3Crop.droughtTolerance === 'high')) {
    reasons.push({
      id: 'reason_water_fit',
      ruleId: 'AGRO-RULE-03-HYDRO-ALIGN',
      category: 'water',
      textEn: `Planting drought-hardy ${s3Crop.name.en} during Season 3 aligns with historic dry-season precipitation, preventing crop failure when rainfall drops.`,
      textFil: `Ang pagtatanim ng matibay sa tagtuyot na ${s3Crop.name.local} sa Ikatlong Panahon ay tugma sa kasaysayan ng mababang ulan, upang maiwasan ang pagkalugi.`,
      dataEvidence: `NASA POWER 10-year monthly data records low precipitation (${climate.seasonalStats.dryHot.precip} mm total) during March–May; crop water requirement matches local water envelope.`
    });
  }

  // High Biomass Residue
  const residueCrops = activeCrops.filter((c) => c.residueBenefit === 'high');
  if (residueCrops.length > 0 && reasons.length < 6) {
    reasons.push({
      id: 'reason_biomass',
      ruleId: 'AGRO-RULE-05-BIOMASS-MULCH',
      category: 'soil',
      textEn: `High biomass stubble from ${residueCrops.map((c) => c.name.en).join(' & ')} acts as natural ground mulch, retaining soil moisture and suppressing weed emergence.`,
      textFil: `Ang masaganang dami ng natitirang tangkay at dahon mula sa ${residueCrops.map((c) => c.name.local).join(' at ')} ay nagsisilbing panakip sa lupa upang mapanatiling mamasa-masa at pigilan ang damo.`,
      dataEvidence: `Supports soil moisture conservation during high evaporative demand periods.`
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
      textEn: `Extreme peak temperatures (${climate.seasonalStats.dryHot.maxTemp}°C recorded by NASA POWER) during late dry season may cause flower abortion if moisture is completely exhausted.`,
      textFil: `Ang matinding init (${climate.seasonalStats.dryHot.maxTemp}°C ayon sa NASA POWER) ay maaaring maglagas ng bulaklak kapag tuluyang natuyo ang lupa.`,
      mitigationEn: 'Apply light mulching with rice straw or schedule early morning sowing to finish flowering before April peak heat.',
      mitigationFil: 'Lagyan ng dayami ang ibabaw ng lupa upang hindi mabilis sumingaw ang tubig at magtanim nang mas maaga.'
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

  // [AGRO-RULE-06-WATER-ACCESS]: Water Access Explanations (Canal, Rainfed, Pump Well, Small Pond)
  const drySeasonActiveCrops = [s2Crop, s3Crop].filter((c) => c.family !== 'fallow');

  if (waterSource === 'irrigation_canal') {
    const highWaterCrops = drySeasonActiveCrops.filter((c) => c.waterDemand === 'high');
    if (highWaterCrops.length > 0) {
      const cropNamesEn = highWaterCrops.map((c) => c.name.en).join(' & ');
      const cropNamesFil = highWaterCrops.map((c) => c.name.local).join(' at ');
      risks.push({
        id: 'risk_canal_curtailment',
        ruleId: 'AGRO-RULE-06-WATER-ACCESS',
        textEn: `High dry-season water demand for ${cropNamesEn} depends on communal/national irrigation canal delivery, which is vulnerable to rotational rationing or upstream curtailment during severe dry spells.`,
        textFil: `Ang mataas na pangangailangan sa tubig ng ${cropNamesFil} sa tag-araw ay umaasa sa patubig ng NIA/kanal na maaaring maantala o magkaroon ng rotational rationing kapag may matinding tagtuyot.`,
        mitigationEn: 'Coordinate with the local Irrigators Association (IA) on canal rotation schedules, or adopt Alternate Wetting and Drying (AWD) water-saving protocols.',
        mitigationFil: 'Makipag-ugnayan sa Irrigators Association (IA) sa iskedyul ng patubig, o magpatupad ng Controlled Irrigation / AWD upang makatipid sa tubig.'
      });
    }
  } else if (waterSource === 'rainfed') {
    const deficitCrops = drySeasonActiveCrops.filter(
      (c) => c.waterDemand === 'high' || (c.waterDemand === 'medium' && c.droughtTolerance !== 'high')
    );
    if (deficitCrops.length > 0) {
      const cropNamesEn = deficitCrops.map((c) => c.name.en).join(' & ');
      const cropNamesFil = deficitCrops.map((c) => c.name.local).join(' at ');
      risks.push({
        id: 'risk_rainfed_deficit',
        ruleId: 'AGRO-RULE-06-WATER-ACCESS',
        textEn: `Cultivating ${cropNamesEn} under purely rainfed dry-season conditions risks severe soil moisture deficits and yield collapse without supplementary irrigation.`,
        textFil: `Ang pagtatanim ng ${cropNamesFil} sa tag-araw nang walang patubig (rainfed) ay delikado sa matinding kakulangan sa tubig at pagkalugi dahil sa kakapusan ng ulan.`,
        mitigationEn: 'Shift to drought-tolerant pulses (such as Pag-asa mungbean) or short-cycle cover crops, or construct a rainwater collection pond.',
        mitigationFil: 'Lumipat sa mga pananim na matipid sa tubig tulad ng Pag-asa munggo o magtatag ng maliit na imbakan ng tubig-ulan.'
      });
    }

    const droughtFitCrops = drySeasonActiveCrops.filter(
      (c) => c.waterDemand === 'low' && c.droughtTolerance === 'high'
    );
    if (droughtFitCrops.length > 0) {
      const cropNamesEn = droughtFitCrops.map((c) => c.name.en).join(' & ');
      const cropNamesFil = droughtFitCrops.map((c) => c.name.local).join(' at ');
      reasons.push({
        id: 'reason_rainfed_drought_fit',
        ruleId: 'AGRO-RULE-06-WATER-ACCESS',
        category: 'water',
        textEn: `Planting ${cropNamesEn} leverages low water demand and high drought tolerance, securing stable yields using only residual soil moisture under rainfed conditions.`,
        textFil: `Ang pagtatanim ng ${cropNamesFil} ay angkop sa rainfed dahil matipid sa tubig at matibay sa tagtuyot, kaya sumasapat ang natitirang halumigmig sa lupa kahit walang irigasyon.`,
        dataEvidence: `Field water source is rainfed; selected dry-season crops feature low water demand and high drought resilience.`
      });
    }
  } else if (waterSource === 'pump_well') {
    if (drySeasonActiveCrops.length > 0) {
      risks.push({
        id: 'risk_pump_fuel_cost',
        ruleId: 'AGRO-RULE-06-WATER-ACCESS',
        textEn: `Shallow tube well / pump irrigation secures dry-season water supply but incurs substantial pumping fuel or electricity costs that reduce net crop margins.`,
        textFil: `Ang paggamit ng poso o pambomba ng tubig ay nagbibigay ng maaasahang patubig sa tag-araw ngunit nagdudulot ng mataas na gastos sa krudo o kuryente na nagpapababa ng kita.`,
        mitigationEn: 'Implement Alternate Wetting and Drying (AWD) or furrow basin irrigation to minimize operating hours and pumping fuel consumption.',
        mitigationFil: 'Magsagawa ng Controlled Irrigation / AWD o maayos na tudling upang mabawasan ang oras ng pagpapatakbo ng bomba at makatipid sa krudo.'
      });

      if (drySeasonActiveCrops.some((c) => c.waterDemand === 'high')) {
        reasons.push({
          id: 'reason_pump_water_buffer',
          ruleId: 'AGRO-RULE-06-WATER-ACCESS',
          category: 'water',
          textEn: `On-demand shallow tube well pumping buffers high water-demand crops against dry-season moisture stress.`,
          textFil: `Ang patubig mula sa poso o bomba ay nagpoprotekta sa mga pananim na nangangailangan ng maraming tubig laban sa tagtuyot sa tag-araw.`,
          dataEvidence: `Pump irrigation provides flexible groundwater extraction during low-rainfall periods.`
        });
      }
    }
  } else if (waterSource === 'small_pond') {
    const pondStressCrops = drySeasonActiveCrops.filter(
      (c) => c.waterDemand === 'high' || (c.waterDemand === 'medium' && c.droughtTolerance !== 'high')
    );
    if (pondStressCrops.length > 0) {
      const cropNamesEn = pondStressCrops.map((c) => c.name.en).join(' & ');
      const cropNamesFil = pondStressCrops.map((c) => c.name.local).join(' at ');
      risks.push({
        id: 'risk_pond_drawdown',
        ruleId: 'AGRO-RULE-06-WATER-ACCESS',
        textEn: `High water demand for ${cropNamesEn} may deplete small farm reservoir or pond capacity before harvest, especially during severe heat.`,
        textFil: `Maaaring maubos ang tubig sa maliit na imbakan (pond) bago mag-ani ng ${cropNamesFil} dahil sa mataas na konsumo at mabilis na pagsingaw sa tag-init.`,
        mitigationEn: 'Prioritize supplemental watering only during critical flowering and grain-filling stages, and apply organic mulching to reduce evaporative loss.',
        mitigationFil: 'Gamitin lamang ang tubig ng imbakan sa kritikal na yugto ng pamumulaklak at lagyan ng mulch ang lupa upang mabawasan ang pagsingaw.'
      });
    }

    const pondFitCrops = drySeasonActiveCrops.filter(
      (c) => c.waterDemand === 'low' && c.droughtTolerance === 'high'
    );
    if (pondFitCrops.length > 0) {
      const cropNamesEn = pondFitCrops.map((c) => c.name.en).join(' & ');
      const cropNamesFil = pondFitCrops.map((c) => c.name.local).join(' at ');
      reasons.push({
        id: 'reason_pond_water_fit',
        ruleId: 'AGRO-RULE-06-WATER-ACCESS',
        category: 'water',
        textEn: `Low-water crops (${cropNamesEn}) conserve small farm pond reserves, sustaining irrigation availability across the entire dry season.`,
        textFil: `Ang mga pananim na matipid sa tubig (${cropNamesFil}) ay nagtitipid sa imbakan ng tubig (pond) upang magtagal ang patubig sa buong tag-araw.`,
        dataEvidence: `Small farm reservoir volume is matched with low water-demand, drought-resilient crops.`
      });
    }
  }

  return { reasons, risks };
}
