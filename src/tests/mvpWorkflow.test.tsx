import {createElement,isValidElement} from 'react';
import type {ReactNode,ReactElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {useAppStore} from '../store/useAppStore';
import {CacheService} from '../services/cache';
import {PILOT_LOCATIONS} from '../data/pilotLocations';
import {resolvePlanningSoil,hasDemoSoil} from '../services/planningSoil';
import {PrintablePlan} from '../components/PrintablePlan';
import {getTranslation} from '../i18n';
import {fetchLandSummary} from '../services/landSummary';
import {MapPicker} from '../components/MapPicker';
import {SoilCard} from '../components/SoilCard';
import {resolveBundledNdvi} from '../services/bundledNdvi';
import {resolveBundledPower} from '../services/bundledPower';
import type {SoilData} from '../types';
vi.mock('leaflet',()=>({default:{}}));
vi.mock('../store/useAppStore',async original=>{
 const module=await original<typeof import('../store/useAppStore')>();
 return {useAppStore:Object.assign(()=>module.useAppStore.getState(),module.useAppStore)};
});
beforeEach(async()=>{useAppStore.setState(useAppStore.getInitialState(),true);await CacheService.clear();vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));});
afterEach(()=>{vi.unstubAllGlobals();});

// Exercise the actual rendered handlers with the mocked store hook, without
// introducing a browser/DOM dependency into the node test environment.
type ControlProps={children?:ReactNode;onClick?:()=>void};
function nodeText(node:ReactNode):string{
 if(typeof node==='string'||typeof node==='number')return String(node);
 if(Array.isArray(node))return node.map(nodeText).join('');
 return isValidElement<ControlProps>(node)?nodeText(node.props.children):'';
}
function findButton(node:ReactNode,label:string):ReactElement<ControlProps>|undefined{
 if(Array.isArray(node))return node.map(child=>findButton(child,label)).find(Boolean);
 if(!isValidElement<ControlProps>(node))return undefined;
 if(node.type==='button'&&nodeText(node.props.children).trim()===label)return node;
 return findButton(node.props.children,label);
}
async function clickSoilButton(label:string){
 const button=findButton(await SoilCard({}),label);
 expect(button?.props.onClick,`Missing soil control: ${label}`).toBeTypeOf('function');
 button!.props.onClick!();
}

it.each(['texture-first','drainage-first'] as const)('keeps independent soil controls with no model evidence: %s',async order=>{
 const base:SoilData={source:'Live/reference profile',texture:'loam',drainage:null,ph:6.4,organicMatter:'medium',isEstimate:false};
 useAppStore.setState({soilData:base});
 if(order==='drainage-first')await clickSoilButton('Poor');
 await clickSoilButton('Sandy');
 expect(useAppStore.getState().soilOverride?.drainage).toBe(order==='drainage-first'?'poor':undefined);
 if(order==='texture-first')await clickSoilButton('Poor');
 const state=useAppStore.getState();
 const effective=resolvePlanningSoil(base,state.soilOverride,true);
 expect(effective).toMatchObject({texture:'sandy',drainage:'poor'});
 expect(effective.provenance?.drainage?.tier).toBe('farmer');
 expect(base).toMatchObject({texture:'loam',drainage:null});
});

it('does not derive phosphorus risk from demo pH on unrelated edits, but honors explicit field pH',()=>{
 const base:SoilData={source:'Missing source readings',texture:null,drainage:null,ph:null,organicMatter:'unknown',isEstimate:false};
 for(const override of [null,{texture:'loam' as const},{drainage:'poor' as const},{organicMatter:'high' as const}]){
  const effective=resolvePlanningSoil(base,override,true);
  expect(effective.ph).toBe(6.3);
  expect(effective.provenance?.ph?.isSynthetic).toBe(true);
  expect(effective.phosphorusFixationRisk).toBeUndefined();
  expect(effective.provenance?.phosphorusFixationRisk?.tier??'unavailable').toBe('unavailable');
 }
 const explicit=resolvePlanningSoil(base,{ph:5.2},true);
 expect(explicit.phosphorusFixationRisk).toBe('high');
 expect(explicit.provenance?.phosphorusFixationRisk).toMatchObject({tier:'farmer',isSynthetic:false,variable:'pH → phosphorusFixationRisk'});
 expect(resolvePlanningSoil(base,{ph:null},true).phosphorusFixationRisk).toBeUndefined();
 expect(resolvePlanningSoil({...base,phosphorusFixationRisk:'high'},{texture:'loam'},true).phosphorusFixationRisk).toBe('high');
});
it.each(PILOT_LOCATIONS)('uses source-derived inputs before demo defaults offline at $id',async pilot=>{
 await useAppStore.getState().selectPilotPreset(pilot);
 const state=useAppStore.getState();
 expect(fetch).not.toHaveBeenCalled();
 expect(state.recommendedPlans.length).toBeGreaterThan(0);
 const original=JSON.stringify(state.soilData);
 const effective=resolvePlanningSoil(state.soilData!,state.soilOverride,state.useDemoAssumptions);
 expect(hasDemoSoil(effective)).toBe(false);
 expect(effective.provenance?.drainage?.tier).toBe('synthetic');
 expect(effective.provenance?.organicMatter?.tier).toBe('synthetic');
 expect(effective.ph).toBe(state.soilData!.ph);
 expect(JSON.stringify(state.soilData)).toBe(original);
 expect(renderToStaticMarkup(createElement(PrintablePlan))).not.toContain(getTranslation('en','mvp.printNotice'));
 useAppStore.getState().setDemoAssumptions(false);
 expect(useAppStore.getState().recommendedPlans.map(plan=>plan.scores)).toEqual(state.recommendedPlans.map(plan=>plan.scores));
 // Simulate a genuinely missing input without changing the source packages.
 const incomplete={...state.soilData!,drainage:null};
 useAppStore.setState({soilData:incomplete});
 useAppStore.getState().setDemoAssumptions(true);
 expect(hasDemoSoil(resolvePlanningSoil(incomplete,null,true))).toBe(true);
 expect(incomplete.drainage).toBeNull();
 useAppStore.getState().setDemoAssumptions(false);
 expect(useAppStore.getState().recommendedPlans).toEqual([]);
 useAppStore.getState().setDemoAssumptions(true);
 expect(useAppStore.getState().recommendedPlans.length).toBeGreaterThan(0);
});
it.each(['en','fil'] as const)('labels demo inputs and printed output in %s and respects explicit clears',async language=>{
 await useAppStore.getState().selectPilotPreset(PILOT_LOCATIONS[1]);
 useAppStore.setState({soilData:{...useAppStore.getState().soilData!,drainage:null}});
 useAppStore.getState().computeRecommendations();
 useAppStore.getState().setLanguage(language);
 const print=renderToStaticMarkup(createElement(PrintablePlan));
 expect(print).toContain(getTranslation(language,'mvp.printNotice'));
 expect(print.indexOf(getTranslation(language,'mvp.printNotice'))).toBeLessThan(print.indexOf('Farm Location &amp; Telemetry'));
 const soil=renderToStaticMarkup(createElement(SoilCard));
 expect(soil).toContain(getTranslation(language,'mvp.soilNotice'));
 expect(soil.split(getTranslation(language,'mvp.soilNotice'))).toHaveLength(2);
 expect(soil).toContain('<details');
 useAppStore.getState().setSoilOverride({ph:null});
 expect(useAppStore.getState().recommendedPlans).toEqual([]);
 useAppStore.getState().resetSoilOverride();
 expect(useAppStore.getState().recommendedPlans.length).toBeGreaterThan(0);
 useAppStore.getState().setSoilOverride({texture:'loam',drainage:'well',ph:6.8,organicMatter:'medium'});
 const state=useAppStore.getState();
 const effective=resolvePlanningSoil(state.soilData!,state.soilOverride,true);
 expect(hasDemoSoil(effective)).toBe(false);
 expect(effective.provenance?.ph?.tier).toBe('farmer');
 expect(renderToStaticMarkup(createElement(PrintablePlan))).not.toContain(getTranslation(language,'mvp.printNotice'));
});
it('keeps coordinate matching tolerant of rounding without inventing nearby coverage',()=>{
 const ndvi=resolveBundledNdvi(15.714+1e-10,120.906);
 expect(ndvi).not.toBeNull();
 expect(ndvi!.provenance.sampleLocation).toBeUndefined();
 expect(resolveBundledPower(15.714+1e-10,120.906,'20140101','20231231')).not.toBeNull();
 expect(resolveBundledNdvi(15.715,120.906)).toBeNull();
 expect(resolveBundledPower(15.715,120.906,'20140101','20231231')).toBeNull();
 const pilot=PILOT_LOCATIONS[0];
 expect(resolveBundledNdvi(pilot.lat,pilot.lon)?.provenance.sampleLocation).toMatchObject({lat:15.714,lon:120.906});
 expect(resolveBundledPower(pilot.lat,pilot.lon,'20140101','20231231')?.dataLocation).toMatchObject({lat:15.714,lon:120.906});
});
it('offers a separate synthetic vegetation example while preserving the rejected Ilagan observations',async()=>{
 const pilot=PILOT_LOCATIONS[1];
 await useAppStore.getState().selectPilotPreset(pilot);
 const land=useAppStore.getState().landSummary!;
 expect(land.ndvi.evidence?.accepted).toBe(0);
 expect(land.ndvi.seasonalMean).toEqual(Array(12).fill(null));
 expect(land.screening?.erosionConcern).toBe('gentle');
 expect(land.floodProne).toBe(false);
 expect(land.rusleErosionRiskTonsHaYr).toBeNull();
 const html=renderToStaticMarkup(createElement(MapPicker));
 expect(html).toContain(getTranslation('en','mvp.exampleNdvi'));
 expect(html).toContain(getTranslation('en','mvp.noLandNdvi'));
 expect(html).toContain(getTranslation('en','mvp.erosion.gentle'));
 expect(html).not.toContain('Unavailable, Unavailable');
 expect(await fetchLandSummary(pilot.lat,pilot.lon)).toMatchObject({screening:{observedMonths:[]}});
});
