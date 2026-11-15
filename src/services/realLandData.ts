import { z } from 'zod';
import { resolveBundledNdvi } from './bundledNdvi';
import rawTerrain from '../data/real-data/terrain-v1.json';
import type { LandSummary, LandMetric, MetricProvenance } from '../types';
import { PILOT_LOCATIONS } from '../data/pilotLocations';
import { unknownProvenance } from '../data/provenance';

const asset = z.object({url: z.url().refine(url=>url.startsWith('https://api.opentopodata.org/v1/srtm30m?')), retrievedAt:z.iso.datetime({offset:true}),sha256:z.string().regex(/^[a-f0-9]{64}$/),file:z.string()});
export const TerrainPackageSchema = z.object({
  schemaVersion:z.literal(1),id:z.literal('srtm-pilots-v1'),source:z.string(),sourceUrl:z.literal('https://api.opentopodata.org/v1/srtm30m'),
  citation:z.literal('https://doi.org/10.5067/MEaSUREs/SRTM/SRTMGL1.003'),licenseUrl:z.url(),
  observationPeriod:z.literal('2000-02-11/2000-02-21'),verticalDatum:z.literal('EGM96 geoid'),resolutionArcSeconds:z.literal(1),retrievedAt:z.iso.datetime({offset:true}),
  grids:z.array(z.object({id:z.enum(['munoz','ilagan','pototan','bukidnon']),lat:z.number().min(-90).max(90),lon:z.number().min(-180).max(180),rows:z.literal(35),cols:z.literal(35),northArcSeconds:z.number().int(),westArcSeconds:z.number().int(),elevationM:z.array(z.number().min(-500).max(9000).nullable()).length(1225),assets:z.array(asset).length(13)})).length(4)
}).superRefine((data,ctx)=>{
 if(new Set(data.grids.map(g=>g.id)).size!==4)ctx.addIssue({code:'custom',message:'Duplicate pilot grid'});
 for(const grid of data.grids) if(grid.northArcSeconds!==Math.round(grid.lat*3600)+17 || grid.westArcSeconds!==Math.round(grid.lon*3600)-17)ctx.addIssue({code:'custom',message:'Grid differs from pilot coordinates'});
});
const parsed=TerrainPackageSchema.safeParse(rawTerrain);
const terrain=parsed.success?parsed.data:null;
if(!terrain)console.warn('SRTM package failed validation; using existing labeled land references.');

/** Horn gradient, percent slope. Horizontal spacing uses WGS84 local radii of
 * curvature, not angular degrees. Null neighbors prevent a slope estimate. */
export function terrainSlopePercent(zs: Array<number|null>,lat:number):number|null {
 if(!Number.isFinite(lat)||Math.abs(lat)>=90||zs.length!==9||!zs.every((v):v is number=>v!==null&&Number.isFinite(v)))return null;
 const phi=lat*Math.PI/180, a=6378137,e2=0.0066943799901413165;
 const d=1-e2*Math.sin(phi)**2, radians=Math.PI/(180*3600);
 const dx=a/Math.sqrt(d)*Math.cos(phi)*radians;
 const dy=a*(1-e2)/(d**1.5)*radians;
 const x=((zs[2]+2*zs[5]+zs[8])-(zs[0]+2*zs[3]+zs[6]))/(8*dx);
 const y=((zs[6]+2*zs[7]+zs[8])-(zs[0]+2*zs[1]+zs[2]))/(8*dy);
 return Number((100*Math.hypot(x,y)).toFixed(2));
}
export function resolveRealLand(lat:number,lon:number,data=terrain):LandSummary|null {
 if(!data||!Number.isFinite(lat)||!Number.isFinite(lon))return null;
 for(const grid of data.grids){
  const row=Math.floor(grid.northArcSeconds-lat*3600+0.5),col=Math.floor(lon*3600-grid.westArcSeconds+0.5);
  if(row<1||row>33||col<1||col>33)continue;
  const elevation=grid.elevationM[row*35+col];
  const neighbors=[-1,0,1].flatMap(dr=>[-1,0,1].map(dc=>grid.elevationM[(row+dr)*35+col+dc]));
  const slope=terrainSlopePercent(neighbors,(grid.northArcSeconds-row)/3600);
  const fields:LandMetric[]=['elevationM','slopePct','floodProne','bareFieldMonths','rusleErosionRiskTonsHaYr','ndvi.seasonalMean','ndvi.trend'];
  const provenance=Object.fromEntries(fields.map(key=>[key,unknownProvenance('No verified source',key)])) as Record<LandMetric,MetricProvenance>;
  for(const key of ['elevationM','slopePct'] as const)provenance[key]={
   source:data.source,variable:key==='elevationM'?'SRTM elevation':'SRTM elevation → Horn percent slope',
   spatialResolution:'1 arc-second (~30 m)',dateRange:data.observationPeriod,isSample:false,isSynthetic:false,needsReview:true,
   tier:(key==='elevationM'?elevation:slope)===null?'unavailable':'bundled-model',unit:key==='elevationM'?'m EGM96':'%',
   productVersion:'003',citation:data.citation,retrievedAt:data.retrievedAt,
   methodKey:key==='elevationM'?'land.nativeElevation':'land.hornSlope',
   note:'SRTM surface estimate from February 2000, sampled through the Open Topo Data mirror with nearest-neighbor interpolation. Vegetation/buildings and raster quantization affect elevation and slope; verify field terrain locally.'
  };
  const vegetation=resolveBundledNdvi(lat,lon);
  if(vegetation){
   provenance['ndvi.seasonalMean']={...vegetation.provenance,tier:vegetation.ndvi.seasonalMean.some(v=>v!==null)?'bundled-model':'unavailable'};
   provenance['ndvi.trend']={...vegetation.provenance,variable:'QA-filtered annual NDVI → OLS slope',unit:'NDVI/year',tier:vegetation.ndvi.trendAvailable?'bundled-model':'unavailable',methodKey:'land.qualityNdviTrend'};
  }
  const monthly=vegetation?.ndvi.seasonalMean??Array.from({length:12},()=>null);
  const observedMonths=monthly.flatMap((v,i)=>v===null?[]:[i+1]);
  const bare=monthly.flatMap((v,i)=>i<6&&v!==null&&v<0.25?[i+1]:[]);
  provenance.floodProne={...provenance.slopePct,variable:'SRTM elevation + slope → preliminary lowland screen',unit:'class',methodKey:'mvp.lowlandMethod',tier:elevation===null||slope===null?'unavailable':'bundled-model'};
  provenance.bareFieldMonths={...(vegetation?.provenance??unknownProvenance('NASA MOD13Q1.061','NDVI')),
   variable:'QA-filtered NDVI <0.25 · January–June',methodKey:'mvp.bareMethod',tier:observedMonths.some(m=>m<=6)?'bundled-model':'unavailable'};
  return {elevationM:elevation,slopePct:slope,floodProne:elevation===null||slope===null?null:elevation<30&&slope<=3,bareFieldMonths:bare,
   screening:{erosionConcern:slope===null?null:slope>15?'steep':slope<=3?'gentle':'sloping',observedMonths,missingMonths:monthly.flatMap((v,i)=>v===null?[i+1]:[])},rusleErosionRiskTonsHaYr:null,
   ndvi:vegetation?.ndvi??{seasonalMean:Array.from({length:12},()=>null),trend:0,source:'Scientific NDVI not acquired',trendAvailable:false,trendUnavailableReason:'Quality-controlled scientific NDVI observations are required.'},
   isSample:false,needsReview:true,reviewNotes:[provenance.elevationM.note,'Flood susceptibility, bare soil and quantitative erosion are not established by elevation alone.'],
   sampleHub:{id:grid.id,name:PILOT_LOCATIONS.find(p=>p.id===grid.id)?.name??grid.id,lat:grid.lat,lon:grid.lon,distanceKm:0},provenance};
 }
 return null;
}

/** Feed the acquired slope into existing rules without deriving flood risk,
 * drainage or erosion from elevation. A missing real post removes a legacy
 * slope substitute rather than silently retaining it. */
export function withTerrainEvidence(soil:import('../types').SoilData,land:LandSummary|null):import('../types').SoilData {
 if(!land||land.isSample)return soil;
 const {slopePct:_old,...rest}=soil;
 const provenance={...soil.provenance,slopePct:land.provenance.slopePct};
 return land.slopePct===null?{...rest,provenance}:{...rest,slopePct:land.slopePct,provenance};
}
