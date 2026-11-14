import type { CandidateSequence } from './candidateGenerator';
import type { ClimateData, PlanReason, PlanRisk, SoilData } from '../types';

export function generatePlanExplanations(
  seq: CandidateSequence,
  climate: ClimateData,
  soil: SoilData
): { reasons: PlanReason[]; risks: PlanRisk[] } {
  const { s1Crop, s2Crop, s3Crop } = seq;
  const reasons: PlanReason[] = [];
  const risks: PlanRisk[] = [];

  // RULE 1: Nitrogen Fixation / Legume Inclusion
  const legumes = [s1Crop, s2Crop, s3Crop].filter((c) => c.nitrogenFixing);
  if (legumes.length > 0) {
    const legumeNamesEn = legumes.map((c) => c.name.en).join(' and ');
    const legumeNamesFil = legumes.map((c) => c.name.local).join(' at ');
    reasons.push({
      id: 'reason_nfix',
      ruleId: 'AGRO-RULE-01-NFIX',
      category: 'soil',
      textEn: `Incorporating ${legumeNamesEn} naturally fixes 35–80 kg N/ha of atmospheric nitrogen, revitalizing soil organic fertility and reducing chemical urea fertilizer costs for the next season.`,
      textFil: `Ang pagtatanim ng ${legumeNamesFil} ay natural na nagbabalik ng 35–80 kg/ektarya ng nitroheno sa lupa, na nagpapalusog sa lupa at nagpapababa ng gastos sa abono.`,
      dataEvidence: `Soil Organic Matter level is ${soil.organicMatter.toUpperCase()} (SOC ${soil.rawSocDgPerKg ? (soil.rawSocDgPerKg / 100).toFixed(2) + '%' : 'baseline'}). Biological N-fixation directly addresses nitrogen depletion.`
    });
  }

  // RULE 2: Root Stratification & Soil Compaction Break
  const rootDepths = [s1Crop.rootDepth, s2Crop.rootDepth, s3Crop.rootDepth];
  if (rootDepths.includes('deep') && rootDepths.includes('shallow')) {
    const deepCrop = [s1Crop, s2Crop, s3Crop].find((c) => c.rootDepth === 'deep');
    reasons.push({
      id: 'reason_root_depth',
      ruleId: 'AGRO-RULE-02-ROOT-STRAT',
      category: 'resilience',
      textEn: `Deep-rooting ${deepCrop?.name.en} aerates the subsoil, breaks up plow pans, and pulls up deep moisture and micronutrients that shallow-rooted crops cannot reach.`,
      textFil: `Ang malalim na ugat ng ${deepCrop?.name.local} ay nagbubungkal sa matigas na ilalim ng lupa at humihigop ng sustansya at tubig mula sa ilalim na hindi abot ng ibang pananim.`,
      dataEvidence: `Texture is classified as ${soil.texture.replace('_', ' ').toUpperCase()}; multi-level rooting prevents hardpan formation under heavy agricultural equipment.`
    });
  }

  // RULE 3: Water Alignment with NASA POWER Climatology
  if (s3Crop.waterDemand === 'low' || s3Crop.droughtTolerance === 'high') {
    reasons.push({
      id: 'reason_water_fit',
      ruleId: 'AGRO-RULE-03-HYDRO-ALIGN',
      category: 'water',
      textEn: `Planting drought-hardy ${s3Crop.name.en} during Season 3 aligns with historic dry-season precipitation, preventing crop failure when rainfall drops.`,
      textFil: `Ang pagtatanim ng matibay sa tagtuyot na ${s3Crop.name.local} sa Ikatlong Panahon ay tugma sa kasaysayan ng mababang ulan, upang maiwasan ang pagkalugi.`,
      dataEvidence: `NASA POWER 10-year monthly data records low precipitation (${climate.seasonalStats.dryHot.precip} mm total) during March–May; crop water requirement matches local water envelope.`
    });
  }

  // RULE 4: Botanical Family Rotation (Pest & Pathogen Break)
  const families = [s1Crop.family, s2Crop.family, s3Crop.family];
  const uniqueFamilies = new Set(families).size;
  if (uniqueFamilies === 3) {
    reasons.push({
      id: 'reason_pest_break',
      ruleId: 'AGRO-RULE-04-PEST-BREAK',
      category: 'resilience',
      textEn: `Rotating three distinct botanical plant families (${s1Crop.family}, ${s2Crop.family}, and ${s3Crop.family}) systematically disrupts insect pest cycles, stem-borers, and soil-borne fungal pathogens.`,
      textFil: `Ang pagsasalit ng tatlong magkakaibang uri ng pananim (${s1Crop.name.local}, ${s2Crop.name.local}, at ${s3Crop.name.local}) ay pumiputol sa pamumugad ng peste at sakit sa lupa.`,
      dataEvidence: `No continuous host crop is present for consecutive cycles; eliminates pest buildup without intensive chemical pesticide spraying.`
    });
  }

  // RULE 5: High Biomass Residue
  const residueCrops = [s1Crop, s2Crop, s3Crop].filter((c) => c.residueBenefit === 'high');
  if (residueCrops.length > 0 && reasons.length < 5) {
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

  if (s3Crop.waterDemand === 'low' && climate.seasonalStats.dryHot.maxTemp >= 35.0) {
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

  return { reasons, risks };
}
