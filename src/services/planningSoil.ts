import type {SoilData,MetricProvenance} from '../types';
import {applyFarmerSoilOverride} from './soilGrids';

export const DEMO_SOIL_SOURCE='FieldShift demonstration assumptions';
/** Example inputs, never inferred measurements. Keep native evidence intact;
 * explicit field overrides apply last, including clears/unknown values. */
export function resolvePlanningSoil(base:SoilData,override:Partial<SoilData>|null,demo=false):SoilData{
 if(!demo)return applyFarmerSoilOverride(base,override);
 const defaults:Pick<SoilData,'texture'|'drainage'|'ph'|'organicMatter'>={texture:'clay_loam',drainage:'moderate',ph:6.3,organicMatter:'medium'};
 const result:SoilData={...base,provenance:{...base.provenance}};
 for(const key of ['texture','drainage','ph','organicMatter'] as const){
  if(base[key]!==null&&base[key]!==undefined&&base[key]!=='unknown')continue;
  Object.assign(result,{[key]:defaults[key]});
  result.provenance![key]={source:DEMO_SOIL_SOURCE,variable:key,spatialResolution:null,dateRange:null,
   tier:'synthetic',isSample:true,isSynthetic:true,needsReview:true,unit:key==='ph'?'pH':'class',
   methodKey:'mvp.assumptionMethod',note:'Editable example input for workflow demonstration only. Not measured, inferred from SOC/texture, or farmer-reported.'} satisfies MetricProvenance;
 }
 return applyFarmerSoilOverride(result,override);
}
export function hasDemoSoil(soil:SoilData|null):boolean{
 return !!soil&&Object.values(soil.provenance??{}).some(p=>p?.source===DEMO_SOIL_SOURCE&&p.isSynthetic);
}
