import type { DailySeries } from './nasaPower';
import type { ClimateData, ClimateMetric, MetricProvenance, MonthlyClimatePoint } from '../types';
import { PILOT_CONFIG } from '../config/pilot';
import { calculateClimateSummary, calculateLinearRegressionSlope } from '../engine/climate/climateSummary';

const mean = (values: number[]) => values.reduce((a,b)=>a+b,0)/values.length;
const round = (value: number) => Number(value.toFixed(1));
const finite = (value: number|null|undefined): value is number => value != null && Number.isFinite(value);

/** Complete calendar years only for totals, dry spells and heat counts. No
 * extrapolation across absent days. Three accepted years minimum for a profile;
 * the per-decade OLS rate is descriptive, not a forecast or significance test. */
export function buildObservedClimate(series: DailySeries): ClimateData|null {
 const byYear = new Map<number,number[]>();
 series.dates.forEach((date,index)=>{
  const year=Number(date.slice(0,4));
  byYear.set(year,[...(byYear.get(year)??[]),index]);
 });
 const years=[...byYear].filter(([year,indices])=>{
  const expected=(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000;
  return indices.length===expected && new Set(indices.map(i=>series.dates[i])).size===expected
   && indices.every((i,n)=>series.dates[i]===new Date(Date.UTC(year,0,1)+n*86400000).toISOString().slice(0,10)
    && finite(series.t2m[i])&&finite(series.t2mMax[i])&&finite(series.prectotcorr[i])&&series.prectotcorr[i]!>=0);
 }).map(([year])=>year).sort((a,b)=>a-b);
 if(years.length<3)return null;
 const indices=years.flatMap(year=>byYear.get(year)!);
 const select=(values:(number|null)[])=>indices.map(i=>values[i]??null);
 const selected:DailySeries={...series,dates:indices.map(i=>series.dates[i]),t2m:select(series.t2m),t2mMax:select(series.t2mMax),prectotcorr:select(series.prectotcorr)};
 const summary=calculateClimateSummary(selected,{maxMissingDayFraction:0});
 // A missing calendar year must not become a fabricated cross-year dry season.
 const adjacentYears=years.some((year,i)=>years[i+1]===year+1);
 if(!adjacentYears)return null;
 const monthly:MonthlyClimatePoint[]=[];
 for(let month=1;month<=12;month++){
  const ids=indices.filter(i=>Number(series.dates[i].slice(5,7))===month);
  const rhs=ids.map(i=>series.rh2m[i]).filter(finite);
  const solar=ids.map(i=>series.allskySfcSwDwn[i]).filter(finite);
  if(rhs.length/ids.length<0.8||solar.length/ids.length<0.8)return null;
  const mins=ids.map(i=>series.t2mMin?.[i]).filter(finite);
  const rains=years.map(year=>ids.filter(i=>Number(series.dates[i].slice(0,4))===year).reduce((sum,i)=>sum+series.prectotcorr[i]!,0));
  monthly.push({month:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month-1],monthNum:month,
   temp:round(mean(ids.map(i=>series.t2m[i]!))),tempMax:round(Math.max(...ids.map(i=>series.t2mMax[i]!))),
   tempMin:mins.length===ids.length?round(mean(mins)):null,rainfall:round(mean(rains)),
   solarRadiation:round(mean(solar)),humidity:round(mean(rhs))});
 }
 const annualRain=years.map(year=>byYear.get(year)!.reduce((sum,i)=>sum+series.prectotcorr[i]!,0));
 const avgRain=mean(annualRain);
 const trend=avgRain>0?round(calculateLinearRegressionSlope(years,annualRain)*10/avgRain*100):0;
 const season=(months:number[])=>{
  const points=monthly.filter(m=>months.includes(m.monthNum));
  const ids=indices.filter(i=>months.includes(Number(series.dates[i].slice(5,7))));
  return {precip:round(points.reduce((sum,m)=>sum+m.rainfall,0)),avgTemp:round(mean(ids.map(i=>series.t2m[i]!))),maxTemp:Math.max(...points.map(m=>m.tempMax))};
 };
 const level=(value:'low'|'med'|'high')=>value==='med'?'moderate':value;
 const data:ClimateData={source:series.source,variableList:['T2M','T2M_MAX','T2M_MIN','PRECTOTCORR','RH2M','ALLSKY_SFC_SW_DWN'],
  dateRange:`${selected.dates[0]} to ${selected.dates.at(-1)}`,isSampleData:series.isSample,
  meanAnnualPrecipitation:round(avgRain),meanAnnualTemp:round(mean(selected.t2m.filter(finite))),monthly,
  seasonalStats:{wet:season([6,7,8,9,10,11]),dryCool:season([12,1,2]),dryHot:season([3,4,5])},
  heatStressDaysPerYear:round(mean(years.map(year=>byYear.get(year)!.filter(i=>series.t2mMax[i]!>=PILOT_CONFIG.thresholds.heatStressTempThresholdC).length))),
  drySpellRisk:level(summary.risks.drought),excessWaterRisk:level(summary.risks.flood),heatRisk:level(summary.risks.heat),
  tenYearRainfallTrend:trend>0?'increasing':trend<0?'decreasing':'stable',trendDeltaPercent:trend};
 const definitions:Record<ClimateMetric,[string,string,string]>={
  precipitation:['PRECTOTCORR','mm/month; mm/year','Mean of complete calendar-month/year rainfall totals.'],
  temperature:['T2M','°C','Daily mean temperature averaged over accepted complete years.'],
  maximumTemperature:['T2M_MAX','°C','Highest daily maximum within each calendar month across accepted years; seasonal maximum of these extremes.'],
  minimumTemperature:['T2M_MIN','°C','Daily minima averaged by calendar month; unavailable where any minimum is absent.'],
  solarRadiation:['ALLSKY_SFC_SW_DWN','MJ/m²/day','Calendar-month daily mean; minimum 80% observed coverage.'],
  humidity:['RH2M','%','Calendar-month daily mean; minimum 80% observed coverage.'],
  heatStressDays:['T2M_MAX ≥ 35 °C','days/year','Mean annual count in complete calendar years; 35 °C screening threshold requires local crop review.'],
  rainfallTrend:['PRECTOTCORR → OLS annual totals','%/decade','OLS against actual accepted calendar years, slope × 10 ÷ mean annual rainfall × 100. Direction uses the rounded slope; no statistical significance claim.'],
  risk:['daily rainfall / Tmax → preliminary screens','class','Existing PILOT_CONFIG thresholds applied to complete Jun–Nov and Dec–May seasons. Rainfall screening does not establish parcel flood hazard.' ]};
 data.provenance=Object.fromEntries(Object.entries(definitions).map(([key,[variable,unit,method]])=>[key,{
  source:series.source,variable,unit,spatialResolution:key==='solarRadiation'?'1° × 1° (CERES SYN1deg, 2014–2023)':'0.5° latitude × 0.625° longitude',
  dateRange:data.dateRange,isSample:series.isSample,isSynthetic:false,needsReview:true,tier:series.tier==='cache'?'cached-live':series.tier,
  methodKey:`provenance.observedMethods.${key}`,
  method:`${method} Accepted complete years: ${years.join(', ')}; ${byYear.size-years.length} years excluded.`,
  note:'Regional gridded estimates, not field measurements. Heat/rainfall risk thresholds are uncalibrated advisory screens needing local scientific review.',
  citation:'https://power.larc.nasa.gov/docs/services/',retrievedAt:series.retrievedAt??null,productVersion:series.apiVersion??null,
  sampleLocation:series.dataLocation,
 } satisfies MetricProvenance]));
 if(avgRain===0)data.provenance.rainfallTrend={...data.provenance.rainfallTrend!,tier:'unavailable'};
 if(monthly.some(m=>m.tempMin===null))data.provenance.minimumTemperature={...data.provenance.minimumTemperature!,tier:'unavailable'};
 return data;
}
