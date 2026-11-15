import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {CacheService} from '../services/cache';

beforeEach(async()=>{await CacheService.clear();});
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
function storage(value:unknown){
 return {getItem:vi.fn(()=>JSON.stringify(value)),removeItem:vi.fn()};
}
it.each([{}, {timestamp:0}, {timestamp:0,ttlMs:-1}, {timestamp:'now',ttlMs:1000}, {timestamp:Date.now()+86400000,ttlMs:1000}])('rejects malformed or future cache envelopes: %j',async metadata=>{
 const localStorage=storage({...metadata,data:42});
 vi.stubGlobal('window',{localStorage});
 expect(await CacheService.get('corrupt-async')).toBeNull();
 expect(CacheService.getSync('corrupt-sync')).toBeNull();
 expect(localStorage.removeItem).toHaveBeenCalledTimes(2);
});
it('falls through blocked IndexedDB opens to valid local storage',async()=>{
 vi.useFakeTimers();
 const request:Partial<IDBOpenDBRequest>={};
 const localStorage=storage({timestamp:Date.now(),ttlMs:1000,data:{value:42}});
 vi.stubGlobal('window',{indexedDB:{open:()=>request},localStorage});
 const pending=CacheService.get<{value:number}>('blocked');
 request.onblocked?.call(request as IDBOpenDBRequest,Object.assign(new Event('blocked'),{oldVersion:0,newVersion:1}));
 expect(await pending).toEqual({value:42});
 expect(vi.getTimerCount()).toBe(0);
});
it('bounds stalled database opens and closes a late connection',async()=>{
 vi.useFakeTimers();
 const request:Partial<IDBOpenDBRequest>={};
 const close=vi.fn();
 const localStorage=storage({timestamp:Date.now(),ttlMs:60000,data:42});
 vi.stubGlobal('window',{indexedDB:{open:()=>request},localStorage});
 const pending=CacheService.get('stalled');
 await vi.advanceTimersByTimeAsync(2000);
 expect(await pending).toBe(42);
 Object.assign(request,{result:{close}});
 request.onsuccess?.call(request as IDBOpenDBRequest,new Event('success'));
 expect(close).toHaveBeenCalledTimes(1);
 expect(vi.getTimerCount()).toBe(0);
});
it('closes a successfully opened connection after a cache read',async()=>{
 const request:Partial<IDBOpenDBRequest>={};
 const read:Partial<IDBRequest>={};
 const close=vi.fn();
 const db={close,transaction:()=>({objectStore:()=>({get:()=>read})})};
 vi.stubGlobal('window',{indexedDB:{open:()=>request}});
 const pending=CacheService.get('normal-read');
 Object.assign(request,{result:db});
 request.onsuccess?.call(request as IDBOpenDBRequest,new Event('success'));
 await Promise.resolve();await Promise.resolve();
 Object.assign(read,{result:{payload:{timestamp:Date.now(),ttlMs:1000,data:0}}});
 read.onsuccess?.call(read as IDBRequest,new Event('success'));
 expect(await pending).toBe(0);
 expect(close).toHaveBeenCalledTimes(1);
});
it('does not extend cache validity while database opening is stalled',async()=>{
 vi.useFakeTimers();
 const localStorage=storage({timestamp:Date.now(),ttlMs:1000,data:42});
 vi.stubGlobal('window',{indexedDB:{open:()=>({})},localStorage});
 const pending=CacheService.get('expires-during-wait');
 await vi.advanceTimersByTimeAsync(2000);
 expect(await pending).toBeNull();
 expect(localStorage.removeItem).toHaveBeenCalled();
});
it('continues to local storage and releases the database when a write aborts',async()=>{
 const request:Partial<IDBOpenDBRequest>={};
 const tx:Partial<IDBTransaction>={objectStore:vi.fn(()=>({put:vi.fn()} as unknown as IDBObjectStore))};
 const close=vi.fn();const setItem=vi.fn();
 vi.stubGlobal('window',{indexedDB:{open:()=>request},localStorage:{setItem}});
 const pending=CacheService.set('aborted-write',42,1000);
 Object.assign(request,{result:{close,transaction:()=>tx}});
 request.onsuccess?.call(request as IDBOpenDBRequest,new Event('success'));
 await Promise.resolve();await Promise.resolve();
 tx.onabort?.call(tx as IDBTransaction,new Event('abort'));
 await pending;
 expect(close).toHaveBeenCalledTimes(1);
 expect(setItem).toHaveBeenCalledWith('fieldshift_cache_aborted-write',expect.any(String));
 expect(JSON.parse(setItem.mock.calls[0][1]).data).toBe(42);
});
