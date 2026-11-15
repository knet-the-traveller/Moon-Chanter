import { z } from 'zod';
import { PILOT_LOCATIONS } from '../data/pilotLocations';
import raw from '../data/real-data/ndvi-v1.json';
import type { LandSummary, MetricProvenance } from '../types';
import { calculateLinearRegressionSlope } from '../engine/climate/climateSummary';

const observation=z.object({date:z.iso.date(),ndvi:z.number().min(-0.2).max(1).nullable(),
 quality:z.number().int().min(0).max(65534).nullable(),reliability:z.number().int().min(0).max(3).nullable()});
export const NdviPackageSchema=z.object({schemaVersion:z.literal(1),id:z.literal('mod13q1-pilots-v1'),
 product:z.literal('MOD13Q1.061'),source:z.string(),citation:z.literal('https://doi.org/10.5067/MODIS/MOD13Q1.061'),
 requestedPeriod:z.literal('2020-01-01/2024-12-31'),scaleAlreadyApplied:z.literal(true),retrievedAt:z.null(),
 sourceFiles:z.array(z.object({file:z.string(),sha256:z.string().regex(/^[a-f0-9]{64}$/)})).length(5),
 points:z.array(z.object({id:z.enum(['munoz','ilagan','pototan','bukidnon']),lat:z.number().min(-90).max(90),lon:z.number().min(-180).max(180),
 tile:z.string().regex(/^h\d{2}v\d{2}$/),line:z.number().int().min(0).max(4799),sample:z.number().int().min(0).max(4799),
 observations:z.array(observation).length(116)})).length(4)
}).superRefine((data,ctx)=>{
 if(new Set(data.points.map(p=>p.id)).size!==4)ctx.addIssue({code:'custom',message:'Duplicate reference point'});
 for(const point of data.points){
  const dates=point.observations.map(o=>o.date);
  if(new Set(dates).size!==dates.length||dates.some((d,i)=>i>0&&d<=dates[i-1]))ctx.addIssue({code:'custom',message:'Duplicate or unsorted composites'});
 }
});
const parsed=NdviPackageSchema.safeParse(raw);
export type NdviObservation=z.infer<typeof observation>;

/** Conservative land-only screening, not a NASA-mandated universal mask.
 * MOD13 Collection 6.1 user guide tables 4–5; no double scaling. */
export function acceptsNdvi(o:NdviObservation):boolean{
 const q=o.quality;
 return o.ndvi!==null&&q!==null&&o.reliability===0&&(q&3)===0&&((q>>2)&15)<=2
  &&((q>>6)&3)!==3&&(q&(1<<8))===0&&(q&(1<<10))===0&&((q>>11)&7)===1
  &&(q&(1<<14))===0&&(q&(1<<15))===0;
}
const avg=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
/** Complete monthly representation avoids fitting different seasons in each year.
 * Five accepted annual means required; retain unavailable status otherwise. */
export function summarizeScientificNdvi(observations:NdviObservation[]):LandSummary['ndvi']{
 const rows=observations.filter(o=>o.date>='2020-01-01'&&o.date<='2024-12-31');
 const valid=rows.filter(acceptsNdvi);
 const monthlyCounts=Array.from({length:12},(_,m)=>valid.filter(o=>Number(o.date.slice(5,7))===m+1).length);
 const seasonalMean=monthlyCounts.map((_,m)=>{
  const values=valid.filter(o=>Number(o.date.slice(5,7))===m+1);
  if(values.length<3||new Set(values.map(o=>o.date.slice(0,4))).size<2)return null;
  return Number(avg(values.map(o=>o.ndvi!)).toFixed(4));
 });
 const annual=Array.from({length:5},(_,i)=>2020+i).flatMap(year=>{
  const yearRows=valid.filter(o=>Number(o.date.slice(0,4))===year);
  const buckets=Array.from({length:12},(_,m)=>yearRows.filter(o=>Number(o.date.slice(5,7))===m+1));
  if(yearRows.length<16||buckets.some(xs=>xs.length===0))return [];
  return [{year,value:avg(buckets.map(xs=>avg(xs.map(o=>o.ndvi!))))}];
 });
 const trendAvailable=annual.length>=5;
 const trend=trendAvailable?Number(calculateLinearRegressionSlope(annual.map(y=>y.year),annual.map(y=>y.value)).toFixed(5)):0;
 return {seasonalMean,trend,trendAvailable,source:'NASA MOD13Q1.061 · 2020–2024 · QA-filtered',
  trendUnavailableReason:trendAvailable?null:'Five annual profiles with all 12 months and at least 16 accepted composites per year are required.',
  evidence:{accepted:valid.length,total:rows.length,monthlyCounts,annualYears:annual.map(y=>y.year),qualityPolicy:'conservative-land-v1'}};
}

/** Original extraction points and exact named pilot presets only. Relocated
 * presets disclose the original reference point; arbitrary nearby farms do not
 * borrow an extraction because no native pixel polygon has been verified. */
export function resolveBundledNdvi(lat:number,lon:number):{ndvi:LandSummary['ndvi'];provenance:MetricProvenance}|null{
 if(!parsed.success)return null;
 const preset=PILOT_LOCATIONS.find(p=>Math.abs(p.lat-lat)<1e-8&&Math.abs(p.lon-lon)<1e-8);
 const point=parsed.data.points.find(p=>Math.abs(p.lat-lat)<1e-8&&Math.abs(p.lon-lon)<1e-8)??(preset?parsed.data.points.find(p=>p.id===preset.id):undefined);
 if(!point)return null;
 const ndvi=summarizeScientificNdvi(point.observations);
 return {ndvi,provenance:{source:parsed.data.source,variable:'MOD13Q1 NDVI + VI_Quality + pixel_reliability',
  spatialResolution:'250 m nominal MODIS sinusoidal pixel',dateRange:parsed.data.requestedPeriod,
  isSample:false,isSynthetic:false,needsReview:true,tier:ndvi.evidence!.accepted>0?'bundled-model':'unavailable',unit:'NDVI',
  sampleLocation:Math.abs(point.lat-lat)<=1e-8&&Math.abs(point.lon-lon)<=1e-8?undefined:{name:`${preset?.name??point.id} NDVI reference point`,lat:point.lat,lon:point.lon},
  productVersion:'061',citation:parsed.data.citation,retrievedAt:null,methodKey:'land.qualityNdvi',
  method:`Accepted ${ndvi.evidence!.accepted}/${ndvi.evidence!.total} composites; ${point.tile}, line ${point.line}, sample ${point.sample}.`,
  note:'AppEEARS values are already scaled. Composite start dates group observations by month; observation day within each 16-day composite is unavailable. Conservative QA can leave cloudy or water-mixed pixels empty. No gap filling or bare-field inference. Download time was not provided.'}};
}
