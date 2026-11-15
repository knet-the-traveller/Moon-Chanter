import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {useAppStore} from '../store/useAppStore';
import {CacheService} from '../services/cache';
import {PILOT_LOCATIONS} from '../data/pilotLocations';
import {applyFarmerSoilOverride} from '../services/soilGrids';
import {SoilCard} from '../components/SoilCard';
import {RotationCard} from '../components/RotationCard';
import {ComparisonModal} from '../components/ComparisonModal';
import {PrintablePlan} from '../components/PrintablePlan';
import {getTranslation} from '../i18n';

// Only adapt SSR's store subscription. Data services, coverage resolvers,
// caches and recommendation generation remain real in this integration suite.
vi.mock('../store/useAppStore',async original=>{
 const module=await original<typeof import('../store/useAppStore')>();
 return {useAppStore:Object.assign(()=>module.useAppStore.getState(),module.useAppStore)};
});
const initial=useAppStore.getInitialState();
const offline=()=>vi.fn(async(input:string|URL|Request)=>{
 const url=String(input);
 const match=/^\/sample-data\/([a-z-]+)\.json$/.exec(url);
 if(match)return new Response(readFileSync(`public/sample-data/${match[1]}.json`,'utf8'));
 // External requests receive an explicit client failure, with no retries or
 // wall-clock waits. Unexpected asset paths must fail rather than be accepted.
 if(url.startsWith('https://'))return new Response('',{status:400});
 throw new Error(`Unexpected local request: ${url}`);
});
beforeEach(async()=>{
 useAppStore.setState({...initial,useDemoAssumptions:false},true);
 await CacheService.clear();
 vi.stubGlobal('fetch',offline());
});
afterEach(async()=>{await CacheService.clear();vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('Ticket 11 real service/store integration',()=>{
 it.each(PILOT_LOCATIONS)('loads $id offline through the normal selection pipeline',async pilot=>{
  await useAppStore.getState().selectPilotPreset(pilot);
  const state=useAppStore.getState();
  expect(fetch).not.toHaveBeenCalled();
  expect(state.selectedLocation.id).toBe(pilot.id);
  expect(state.landSummary?.sampleHub.id).toBe(pilot.id);
  expect(state.landSummary?.isSample).toBe(false);
  expect(state.landSummary?.ndvi.evidence?.total).toBe(115);
  expect(state.landSummary?.ndvi.trendAvailable).toBe(false);
  expect(state.soilData?.modelEvidence?.gridId).toBe(pilot.id);
  expect(state.soilData?.slopePct).toBe(state.landSummary?.slopePct);
  expect(state.soilData?.provenance?.slopePct?.source).toContain('SRTM');
  expect(state.climateData?.isSampleData).toBe(false);
  expect(state.climateData?.provenance?.heatStressDays?.isSynthetic).toBe(false);
  expect(state.recommendedPlans).toEqual([]); // Missing field-only inputs.
  expect(state.isLoadingLand||state.isLoadingTelemetry).toBe(false);
  expect(state.landError??state.telemetryError).toBeNull();
 });
 it('falls back honestly for a custom field outside every packaged grid',async()=>{
  await useAppStore.getState().setCustomCoordinates(8.2,125.2);
  const state=useAppStore.getState();
  expect(state.landSummary?.isSample).toBe(true);
  expect(state.landSummary?.sampleHub.id).toBe('bukidnon');
  expect(state.landSummary?.sampleHub.distanceKm).toBeGreaterThan(0);
  expect(state.soilData?.modelEvidence).toBeUndefined();
  expect(state.soilData?.isEstimate).toBe(true);
  expect(state.climateData?.isSampleData).toBe(true);
  expect(state.climateData?.provenance?.precipitation?.sampleLocation?.name).toBe('Science City of Muñoz');
  expect(state.landError??state.telemetryError).toBeNull();
  expect(vi.mocked(fetch).mock.calls.some(([url])=>String(url).includes('power.larc.nasa.gov'))).toBe(true);
 });
 it.each(['en','fil'] as const)('propagates field overrides through plans, dashboard, comparison and print in %s',async language=>{
  await useAppStore.getState().selectPilotPreset(PILOT_LOCATIONS[0]);
  const base=useAppStore.getState().soilData!;
  const before=JSON.stringify(base);
  useAppStore.getState().setLanguage(language);
  useAppStore.getState().setSoilOverride({texture:'clay',drainage:'moderate',organicMatter:'medium',ph:7.1});
  const state=useAppStore.getState();
  expect(state.recommendedPlans.length).toBeGreaterThan(0);
  expect(JSON.stringify(state.soilData)).toBe(before);
  const effective=applyFarmerSoilOverride(state.soilData!,state.soilOverride);
  expect(effective.ph).toBe(7.1);
  expect(effective.provenance?.ph?.tier).toBe('farmer');
  expect(effective.provenance?.slopePct?.source).toContain('SRTM');
  useAppStore.setState({isComparisonModalOpen:true,comparedPlanIds:[state.recommendedPlans[0].id]});
  const soilHtml=renderToStaticMarkup(createElement(SoilCard));
  expect(soilHtml).toContain('7.1 pH');
  for(const view of [createElement(RotationCard,{plan:state.recommendedPlans[0],rank:1}),createElement(ComparisonModal),createElement(PrintablePlan)]){
   const html=renderToStaticMarkup(view);
   expect(html).toContain(getTranslation(language,'provenance.farmer'));
   expect(html).toContain(getTranslation(language,'localReview.override'));
   expect(html).toContain(getTranslation(language,'land.insufficientTrendData'));
   expect(html).not.toMatch(/\{(?:sources|crops)\}/);
  }
  const print=renderToStaticMarkup(createElement(PrintablePlan));
  expect(print).toContain('7.1');
  useAppStore.getState().resetSoilOverride();
  expect(useAppStore.getState().soilOverride).toBeNull();
  expect(useAppStore.getState().soilData).toBe(base);
  expect(useAppStore.getState().recommendedPlans).toEqual([]);
  expect(useAppStore.getState().comparedPlanIds).toEqual([]);
  expect(useAppStore.getState().advisoryIssuedAt).toBeNull();
  useAppStore.getState().setSoilOverride({ph:7.1});
  await useAppStore.getState().selectPilotPreset(PILOT_LOCATIONS[1]);
  expect(useAppStore.getState().soilOverride).toBeNull();
  expect(useAppStore.getState().soilData?.modelEvidence?.gridId).toBe('ilagan');
 });
});
