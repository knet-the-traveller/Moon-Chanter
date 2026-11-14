import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateLocalReviewChecklist } from '../engine/explainer';
import { buildClimateProvenance, buildSoilProvenance, cachedProvenance, formatLocalReview } from '../data/provenance';
import { applyFarmerSoilOverride } from '../services/soilGrids';
import { buildSampleLandSummary } from '../services/landSummary';
import { MunicipalLandFixtureSchema } from '../types/landFixture';
import { RotationCard, LocalReviewChecklist } from '../components/RotationCard';
import { ComparisonModal } from '../components/ComparisonModal';
import { PrintablePlan } from '../components/PrintablePlan';
import { useAppStore } from '../store/useAppStore';
import { getTranslation } from '../i18n';
import type { ClimateData, SoilData } from '../types';

vi.mock('../store/useAppStore', async importOriginal => {
 const original=await importOriginal<typeof import('../store/useAppStore')>();
 return {useAppStore:Object.assign(()=>original.useAppStore.getState(),original.useAppStore)};
});
const raw=JSON.parse(readFileSync('public/sample-data/munoz.json','utf8')) as {climate:ClimateData;soil:SoilData};
const land=buildSampleLandSummary(15.714,120.906,[MunicipalLandFixtureSchema.parse(JSON.parse(readFileSync('public/sample-data/munoz.json','utf8')))]);
const climate={...raw.climate,provenance:buildClimateProvenance(raw.climate,'sample',{name:'Science City of Muñoz'})};
const soil={...raw.soil,provenance:buildSoilProvenance(raw.soil,false,{name:'Science City of Muñoz'},false)};
beforeEach(()=>{
 useAppStore.setState({...useAppStore.getInitialState(),climateData:climate,soilData:soil,landSummary:land},true);
 useAppStore.getState().computeRecommendations();
});

describe('deterministic per-plan local review',()=>{
 it('reflects actual sample, synthetic, review and unsupported trend context',()=>{
  const plan=useAppStore.getState().recommendedPlans[0];
  const context={climate,soil,land};
  const before=JSON.stringify({plan,context});
  const items=generateLocalReviewChecklist(plan,context);
  expect(items.map(item=>item.id)).toEqual(expect.arrayContaining(['municipal','synthetic','review','ndviTrend','pixelScale','canalTurnouts','compaction','buyerPrices']));
  expect(items.find(item=>item.id==='municipal')?.params?.sources).toContain('Science City of Muñoz');
  expect(generateLocalReviewChecklist(plan,context)).toEqual(items);
  expect(JSON.stringify({plan,context})).toBe(before);
 });
 it('updates override/cache descriptors without falsely calling API data a municipal fixture',()=>{
  const plan=useAppStore.getState().recommendedPlans[0];
  const liveClimate={...raw.climate,isSampleData:false,provenance:cachedProvenance(buildClimateProvenance({...raw.climate,isSampleData:false},'live'))};
  const liveSoil={...raw.soil,isEstimate:false,provenance:buildSoilProvenance({...raw.soil,isEstimate:false},true)};
  const overridden=applyFarmerSoilOverride(liveSoil,{texture:'sandy'});
  const items=generateLocalReviewChecklist(plan,{climate:liveClimate,soil:overridden,land:null});
  expect(items.map(item=>item.id)).toContain('override');
  expect(items.map(item=>item.id)).toContain('cached');
  expect(items.map(item=>item.id)).not.toContain('municipal');
  const reset=generateLocalReviewChecklist(plan,{climate:liveClimate,soil:applyFarmerSoilOverride(liveSoil,null),land:null});
  expect(reset.map(item=>item.id)).not.toContain('override');
 });
 it('reports missing datasets and does not turn compatibility zero into a supported NDVI trend',()=>{
  const plan=useAppStore.getState().recommendedPlans[0];
  const items=generateLocalReviewChecklist(plan,{climate:null,soil:null,land:null});
  expect(items.map(item=>item.id)).toContain('unavailable');
  expect(items.map(item=>item.id)).toContain('ndviTrend');
  const supported=generateLocalReviewChecklist(plan,{climate,soil,land:{...land,ndvi:{...land.ndvi,trendAvailable:true,trend:0,trendUnavailableReason:null}}});
  expect(supported.map(item=>item.id)).not.toContain('ndviTrend');
 });
 it.each(['en','fil'] as const)('shows the checklist for each plan in cards, comparison and print in %s',language=>{
  useAppStore.setState({language,isComparisonModalOpen:true});
  const plans=useAppStore.getState().recommendedPlans;
  const context={climate,soil,land};
  const heading=getTranslation(language,'localReview.title').replaceAll('&','&amp;');
  for(const plan of plans){
   const html=renderToStaticMarkup(createElement(RotationCard,{plan,rank:1}));
   expect(html).toContain(heading);
   expect(html).toContain(getTranslation(language,'localReview.canalTurnouts'));
   expect(html).not.toContain('{sources}');
   expect(html).not.toContain('{crops}');
  }
  useAppStore.setState({comparedPlanIds:plans.slice(0,3).map(plan=>plan.id)});
  const comparison=renderToStaticMarkup(createElement(ComparisonModal));
  expect(comparison.split(heading)).toHaveLength(4);
  const print=renderToStaticMarkup(createElement(PrintablePlan));
  expect(print).toContain(heading);
  expect(print).toContain('<h3 class="font-bold text-amber-950">');
  const item=generateLocalReviewChecklist(plans[0],context)[0];
  expect(formatLocalReview(language,item)).not.toMatch(/\{\w+\}/);
  const crop = plans[0].seasons.find(season => season.crop.family !== 'fallow')!.crop;
  expect(renderToStaticMarkup(createElement(LocalReviewChecklist,{plan:plans[0],context,language})))
    .toContain(language === 'fil' ? crop.name.local : crop.name.en);
 });
});
