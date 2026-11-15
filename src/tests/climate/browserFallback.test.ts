import {readFileSync} from 'node:fs';
import {afterEach,it,expect,vi} from 'vitest';
import {loadBundledSampleDailySeries} from '../../services/nasaPower';
const raw:unknown=JSON.parse(readFileSync('public/sample-data/nasa-power-pilot.json','utf8'));
function browser(){vi.stubGlobal('process',{...process,versions:{...process.versions,node:undefined}});}
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.useRealTimers();});
it('loads the climate reference relative to the deployed application base',async()=>{
 browser();vi.stubEnv('BASE_URL','/fieldshift/');
 const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>raw});vi.stubGlobal('fetch',fetch);
 const result=await loadBundledSampleDailySeries({lat:14,lon:121});
 expect(fetch.mock.calls[0][0]).toBe('/fieldshift/sample-data/nasa-power-pilot.json');
 expect(result.isSample).toBe(true);
 expect(result.dataLocation?.lat).toBe(15.714);
});
it('bounds a stalled reference body even when transport ignores abort',async()=>{
 browser();vi.useFakeTimers();let signal:AbortSignal|undefined;
 vi.stubGlobal('fetch',vi.fn((_url:string,options:RequestInit)=>{
  signal=options.signal as AbortSignal;
  return Promise.resolve({ok:true,json:()=>new Promise(()=>{})});
 }));
 const result=expect(loadBundledSampleDailySeries({lat:14,lon:121})).rejects.toThrow('not found');
 await vi.advanceTimersByTimeAsync(5000);await result;
 expect(signal?.aborted).toBe(true);expect(vi.getTimerCount()).toBe(0);
});
