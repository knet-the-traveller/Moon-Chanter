import { z } from 'zod';
import { PILOT_LOCATIONS } from '../data/pilotLocations';
import raw from '../data/real-data/power-v1.json';
import { parsePowerDailyPayload, type DailySeries } from './nasaPower';

export const PowerPackageSchema=z.object({schemaVersion:z.literal(1),id:z.literal('power-pilots-v1'),records:z.array(z.object({
 id:z.enum(['munoz','ilagan','pototan','bukidnon']),lat:z.number().min(-90).max(90),lon:z.number().min(-180).max(180),
 url:z.url().refine(url=>url.startsWith('https://power.larc.nasa.gov/api/temporal/daily/point?')),
 retrievedAt:z.iso.datetime({offset:true}),sha256:z.string().regex(/^[a-f0-9]{64}$/),payload:z.unknown(),
})).length(4)}).refine(data=>new Set(data.records.map(r=>r.id)).size===4);
const parsed=PowerPackageSchema.safeParse(raw);

/** Original extraction points and exact named pilot presets only. Relocated
 * presets explicitly retain the original regional reference in dataLocation.
 * POWER echoes request points; this does not establish native cell coverage. */
export function resolveBundledPower(lat:number,lon:number,start:string,end:string):DailySeries|null {
 if(!parsed.success||start!=='20140101'||end!=='20231231')return null;
 const preset=PILOT_LOCATIONS.find(p=>Math.abs(p.lat-lat)<1e-8&&Math.abs(p.lon-lon)<1e-8);
 const record=parsed.data.records.find(r=>Math.abs(r.lat-lat)<1e-8&&Math.abs(r.lon-lon)<1e-8)??(preset?parsed.data.records.find(r=>r.id===preset.id):undefined);
 if(!record)return null;
 try{
  const series=parsePowerDailyPayload(record.payload,{lat:record.lat,lon:record.lon},'bundled-model','NASA POWER verified pilot extract (2014–2023)');
  const envelope=z.object({geometry:z.object({coordinates:z.array(z.number()).min(2)})}).parse(record.payload);
  if(Math.abs(envelope.geometry.coordinates[0]-record.lon)>1e-8||Math.abs(envelope.geometry.coordinates[1]-record.lat)>1e-8
   ||series.dates[0]!=='2014-01-01'||series.dates.at(-1)!=='2023-12-31'||series.dates.length!==3652)return null;
  series.retrievedAt=record.retrievedAt;
  series.location={lat,lon};
  if(Math.abs(record.lat-lat)>1e-8||Math.abs(record.lon-lon)>1e-8)series.dataLocation={name:`${preset?.name??record.id} regional POWER reference`,lat:record.lat,lon:record.lon};
  return series;
 }catch{return null;}
}
