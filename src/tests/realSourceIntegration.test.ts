import { describe,it,expect,vi,afterEach } from 'vitest';
import rawNdvi from '../data/real-data/ndvi-v1.json';
import { acceptsNdvi,NdviPackageSchema,resolveBundledNdvi,summarizeScientificNdvi } from '../services/bundledNdvi';
import { PowerPackageSchema,resolveBundledPower } from '../services/bundledPower';
import rawPower from '../data/real-data/power-v1.json';
import { buildObservedClimate } from '../services/observedClimate';
import { parsePowerDailyPayload,sanitizePowerValue,fetchNasaPowerClimate,fetchDailySeries,climateCacheKey,type DailySeries } from '../services/nasaPower';
import { summarizeSeasonInstance,calculateClimateSummary } from '../engine/climate/climateSummary';
import { CacheService } from '../services/cache';

const power=PowerPackageSchema.parse(rawPower);
const ndvi=NdviPackageSchema.parse(rawNdvi);
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
const example={date:'2020-01-01',ndvi:0.6,quality:2048,reliability:0};

describe('scientific MODIS NDVI',()=>{
 it('preserves already-scaled CSV values and source point identity',()=>{
  const point=ndvi.points.find(p=>p.id==='munoz')!;
  expect(point.observations[0].ndvi).toBeGreaterThan(-0.2);
  const result=resolveBundledNdvi(point.lat,point.lon)!;
  expect(result.ndvi.evidence).toMatchObject({accepted:77,total:115});
  expect(result.ndvi.seasonalMean[0]).toBeGreaterThan(0.1);
  expect(resolveBundledNdvi(point.lat+0.0001,point.lon)).toBeNull();
  expect(resolveBundledNdvi(NaN,point.lon)).toBeNull();
 });
 it('rejects water, clouds, aerosol, shadow, marginal data, fill and poor usefulness',()=>{
  expect(acceptsNdvi(example)).toBe(true);
  for(const quality of [2048|1,2048|(4<<2),2048|(3<<6),2048|256,2048|1024,0,2048|16384,2048|32768])expect(acceptsNdvi({...example,quality})).toBe(false);
  expect(acceptsNdvi({...example,reliability:1})).toBe(false);
  expect(acceptsNdvi({...example,ndvi:null})).toBe(false);
  expect(acceptsNdvi({...example,quality:null})).toBe(false);
  expect(acceptsNdvi({...example,ndvi:0})).toBe(true);
 });
 it('excludes Ilagan water-mixed pixels, retains cloudy gaps, and declines unsupported annual trends',()=>{
  for(const point of ndvi.points){
   const result=resolveBundledNdvi(point.lat,point.lon)!;
   expect(result.ndvi.trendAvailable).toBe(false);
   expect(result.ndvi.trendUnavailableReason).toContain('Five annual');
   if(point.id==='ilagan'){
    expect(result.ndvi.evidence?.accepted).toBe(0);
    expect(result.ndvi.seasonalMean.every(x=>x===null)).toBe(true);
    expect(result.provenance.tier).toBe('unavailable');
   }
  }
 });
 it('fits five complete annual profiles and rejects missing-season regression',()=>{
  const rows=Array.from({length:5},(_,i)=>Array.from({length:12},(_,m)=>[1,17].map(day=>({...example,
   date:`${2020+i}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`,ndvi:0.3+i*0.02})))).flat(2);
  expect(summarizeScientificNdvi(rows).trend).toBeCloseTo(0.02);
  expect(summarizeScientificNdvi(rows).trendAvailable).toBe(true);
  expect(summarizeScientificNdvi(rows.filter(r=>r.date.slice(5,7)!=='07')).trendAvailable).toBe(false);
  const bad=structuredClone(rawNdvi);bad.points[0].observations[0].ndvi=6000;
  expect(NdviPackageSchema.safeParse(bad).success).toBe(false);
 });
});

describe('measured-date POWER aggregation',()=>{
 it.each(power.records)('calculates actual pilot indicators offline for $id',async record=>{
  await CacheService.clear();
  const fetch=vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('offline'));
  const series=resolveBundledPower(record.lat,record.lon,'20140101','20231231')!;
  const result=await fetchNasaPowerClimate(record.lat,record.lon);
  expect(fetch).not.toHaveBeenCalled();
  expect(series.dates.length).toBe(3652);expect(series.t2mMin?.every(x=>x!==null)).toBe(true);
  const actualHeat=series.t2mMax.filter(t=>t!==null&&t>=35).length/10;
  expect(result.heatStressDaysPerYear).toBe(Number(actualHeat.toFixed(1)));
  const rain=series.prectotcorr.reduce<number>((sum,value)=>sum+value!,0)/10;
  expect(result.meanAnnualPrecipitation).toBeCloseTo(rain,0);
  expect(result.provenance?.heatStressDays?.isSynthetic).toBe(false);
  expect(result.provenance?.risk?.needsReview).toBe(true);
  expect(result.provenance?.minimumTemperature?.variable).toBe('T2M_MIN');
  expect(result.monthly[0].tempMin).not.toBe(Number((result.monthly[0].temp-5).toFixed(1)));
  fetch.mockRestore();
 });
 it('reuses a validated raw cache without another API request and preserves retrieval time',async()=>{
  await CacheService.clear();
  const response={properties:{parameter:{T2M:{'20200101':25},T2M_MAX:{'20200101':30},T2M_MIN:{'20200101':20},PRECTOTCORR:{'20200101':0}}}};
  const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:true,status:200,json:async()=>response} as Response);
  const options={lat:14.5,lon:121.2,startApiFormat:'20200101',endApiFormat:'20200101',maxRetries:0};
  const first=await fetchDailySeries(options);const second=await fetchDailySeries(options);
  expect(fetch).toHaveBeenCalledTimes(1);expect(second.tier).toBe('cache');
  expect(second.retrievedAt).toBe(first.retrievedAt);expect(second.t2mMin).toEqual([20]);
 });
 it('requires full years and retains missing minima rather than subtracting five degrees',()=>{
  const series=resolveBundledPower(15.714,120.906,'20140101','20231231')!;
  const missingMin=structuredClone(series);missingMin.t2mMin=undefined;
  expect(buildObservedClimate(missingMin)?.monthly.every(m=>m.tempMin===null)).toBe(true);
  expect(buildObservedClimate(missingMin)?.provenance?.minimumTemperature?.tier).toBe('unavailable');
  const incomplete=structuredClone(series);incomplete.prectotcorr=incomplete.prectotcorr.map((v,i)=>series.dates[i].endsWith('-01-01')?null:v);
  expect(buildObservedClimate(incomplete)).toBeNull();
  expect(resolveBundledPower(15.7141,120.906,'20140101','20231231')).toBeNull();
  expect(climateCacheKey(15.7141,120.906)).not.toBe(climateCacheKey(15.714,120.906));
 });
 it('breaks dry spells at missing observations and date gaps; includes missing heat in coverage',()=>{
  const result=summarizeSeasonInstance('2020-wet','wet',{dates:['2020-06-01','2020-06-02','2020-06-03','2020-06-05'],
   rain:[0,null,0,0],t2m:[25,25,25,25],t2mMax:[30,30,30,null]},35,1);
  expect(result.maxDrySpellDays).toBe(1);expect(result.missingDays).toBe(2);
 });
 it('pairs regression values with accepted years when an intervening year is excluded',()=>{
  const dates:string[]=[];const temps:number[]=[];const rain:(number|null)[]=[];
  for(let year=2018;year<=2022;year++)for(let day=Date.UTC(year,0,1);day<Date.UTC(year+1,0,1);day+=86400000){
   dates.push(new Date(day).toISOString().slice(0,10));temps.push(year-2000);
   const days=(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000;
   rain.push(year===2019?null:(1000+(year-2018)*100)/days);
  }
  const series:DailySeries={location:{lat:15,lon:120},dates,t2m:temps,t2mMax:temps,prectotcorr:rain,rh2m:temps,allskySfcSwDwn:temps,source:'test',tier:'live',isSample:false};
  const result=calculateClimateSummary(series);
  expect(result.trend10y.tempC).toBe(10);
  expect(result.trend10y.rainfallPct).toBeCloseTo(81.6,1);
 });
 it('keeps valid rainfall and dry days when temperature alone is missing',()=>{
  const result=summarizeSeasonInstance('2020-wet','wet',{
   dates:['2020-06-01','2020-06-02','2020-06-03','2020-06-04'],
   t2m:[25,null,27,29],t2mMax:[30,null,36,37],rain:[7,3,0,0]
  },35,1);
  expect(result.totalRainfallMm).toBe(10);expect(result.meanT2m).toBe(27);
  expect(result.maxDrySpellDays).toBe(2);expect(result.missingDays).toBe(1);
  const dry=summarizeSeasonInstance('2020-wet','wet',{
   dates:['2020-06-01','2020-06-02','2020-06-03'],t2m:[25,null,27],t2mMax:[30,null,36],rain:[0,0,0]
  },35,1);
  expect(dry.maxDrySpellDays).toBe(3);
 });
 it('rejects a POWER response for a different point while preserving labeled references',()=>{
  const raw={geometry:{coordinates:[125,8]},properties:{parameter:{T2M:{'20200101':25}}}};
  expect(()=>parsePowerDailyPayload(raw,{lat:15,lon:120},'live','test')).toThrow('response coordinates differ');
  expect(()=>parsePowerDailyPayload(raw,{lat:15,lon:120},'cache','test')).toThrow('response coordinates differ');
  const reference=parsePowerDailyPayload(raw,{lat:15,lon:120},'sample','reference');
  expect(reference.dataLocation).toMatchObject({lat:8,lon:125});
  expect(()=>parsePowerDailyPayload({...raw,geometry:{coordinates:[120.000049,15.000049]}},{lat:15,lon:120},'live','test')).not.toThrow();
 });
 it('rejects invalid numeric values in a persisted derived profile',async()=>{
  const base=buildObservedClimate(resolveBundledPower(15.714,120.906,'20140101','20231231')!)!;
  for(const property of ['rainfall','humidity','solarRadiation'] as const){
   await CacheService.clear();const invalid=structuredClone(base);invalid.source='invalid cached profile';
   invalid.monthly[0][property]=property==='humidity'?101:-1;
   await CacheService.set(climateCacheKey(15.714,120.906),invalid);
   const result=await fetchNasaPowerClimate(15.714,120.906);
   expect(result.source).toBe(base.source);
   expect(result.monthly[0][property]).toBe(base.monthly[0][property]);
  }
 });
 it('rejects invalid dates and nonfinite values and inserts missing calendar days as null',()=>{
  expect(sanitizePowerValue(Infinity)).toBeNull();
  const parse=(T2M:Record<string,unknown>)=>parsePowerDailyPayload({properties:{parameter:{T2M}}},{lat:15,lon:120},'live','test');
  expect(()=>parse({'20200230':25})).toThrow('Invalid POWER calendar');
  expect(parse({'20200101':25,'20200103':26}).t2m).toEqual([25,null,26]);
 });
});
