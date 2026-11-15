import { z } from 'zod';

/**
 * Resilient Cache Service with IndexedDB, localStorage, and In-Memory tiers.
 * Guaranteed to never throw into callers.
 */

interface CacheRecord<T> {
  timestamp: number;
  ttlMs: number;
  data: T;
}

export const TELEMETRY_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 30; // Legacy default; telemetry callers pass an explicit TTL.
const DB_NAME = 'FieldShiftCacheDB';
const STORE_NAME = 'climateCache';
const DB_VERSION = 1;
const DB_OPEN_TIMEOUT_MS = 2000;
const CacheRecordSchema = z.object({timestamp:z.number().nonnegative(),ttlMs:z.number().positive(),data:z.unknown()});
function validRecord(input:unknown,now:number):input is CacheRecord<unknown> {
  const result=CacheRecordSchema.safeParse(input);
  return result.success && Object.hasOwn(result.data,'data') && result.data.timestamp<=now
    && now-result.data.timestamp<=result.data.ttlMs;
}

export class CacheService {
  private static prefix = 'fieldshift_cache_';
  private static memoryStore = new Map<string, CacheRecord<unknown>>();

  /**
   * Open IndexedDB safely if available in environment.
   */
  private static async getDb(): Promise<IDBDatabase | null> {
    try {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return null;
      }
      return await new Promise<IDBDatabase | null>((resolve) => {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);
        let settled = false;
        const finish = (db:IDBDatabase|null) => {
          if(settled){db?.close();return;}
          settled=true;clearTimeout(timeout);resolve(db);
        };
        const timeout=setTimeout(()=>finish(null),DB_OPEN_TIMEOUT_MS);
        request.onupgradeneeded = () => {
          if(settled){request.transaction?.abort();return;}
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          }
        };
        request.onsuccess = () => finish(request.result);
        request.onerror = () => finish(null);
        request.onblocked = () => finish(null);
      });
    } catch {
      return null;
    }
  }

  /**
   * Retrieve cached value. Checks memory, IndexedDB, and localStorage.
   * Never throws; returns null on miss, expiration, or error.
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.prefix + key;
      const now = Date.now();

      // 1. Check in-memory store
      const memRecord = this.memoryStore.get(fullKey) as CacheRecord<T> | undefined;
      if (memRecord) {
        if (!validRecord(memRecord,now)) {
          this.memoryStore.delete(fullKey);
        } else {
          return memRecord.data;
        }
      }

      // 2. Check IndexedDB if available
      const db = await this.getDb();
      if (db) {
        try {
          const idbRecord = await new Promise<CacheRecord<T> | null>((resolve) => {
            try {
              const tx = db.transaction(STORE_NAME, 'readonly');
              const store = tx.objectStore(STORE_NAME);
              const req = store.get(fullKey);
              req.onsuccess = () => resolve(req.result ? req.result.payload : null);
              req.onerror = () => resolve(null);
            } catch {
              resolve(null);
            }
          });

          if (idbRecord) {
            if (!validRecord(idbRecord,Date.now())) {
              // Delete expired record in background
              try {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).delete(fullKey);
              } catch {
                // ignore
              }
            } else {
              // Cache in memory for quick subsequent access
              this.memoryStore.set(fullKey, idbRecord);
              return idbRecord.data;
            }
          }
        } finally {db.close();}
      }

      // 3. Check localStorage fallback
      if (typeof window !== 'undefined' && window.localStorage) {
        const itemStr = window.localStorage.getItem(fullKey);
        if (itemStr) {
          const localRecord: CacheRecord<T> = JSON.parse(itemStr);
          if (!validRecord(localRecord,Date.now())) {
            window.localStorage.removeItem(fullKey);
          } else {
            this.memoryStore.set(fullKey, localRecord);
            return localRecord.data;
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Store cached value across memory, IndexedDB, and localStorage.
   * Never throws.
   */
  static async set<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): Promise<void> {
    try {
      const fullKey = this.prefix + key;
      const record: CacheRecord<T> = {
        timestamp: Date.now(),
        ttlMs,
        data
      };

      // 1. Store in memory
      this.memoryStore.set(fullKey, record);

      // 2. Store in IndexedDB
      const db = await this.getDb();
      if (db) {
        try {
          await new Promise<void>((resolve) => {
            try {
              const tx = db.transaction(STORE_NAME, 'readwrite');
              const store = tx.objectStore(STORE_NAME);
              store.put({ key: fullKey, payload: record });
              tx.oncomplete = () => resolve();
              tx.onerror = () => resolve();
              tx.onabort = () => resolve();
            } catch {
              resolve();
            }
          });
        } finally {db.close();}
      }

      // 3. Store in localStorage as additional fallback
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(fullKey, JSON.stringify(record));
      }
    } catch {
      // Storage quota or serialization error handled gracefully
    }
  }

  /**
   * Synchronous get helper (uses memory and localStorage). Never throws.
   */
  static getSync<T>(key: string): T | null {
    try {
      const fullKey = this.prefix + key;
      const now = Date.now();

      const memRecord = this.memoryStore.get(fullKey) as CacheRecord<T> | undefined;
      if (memRecord) {
        if (validRecord(memRecord,now)) {
          return memRecord.data;
        }
        this.memoryStore.delete(fullKey);
      }

      if (typeof window !== 'undefined' && window.localStorage) {
        const itemStr = window.localStorage.getItem(fullKey);
        if (itemStr) {
          const localRecord: CacheRecord<T> = JSON.parse(itemStr);
          if (validRecord(localRecord,now)) {
            this.memoryStore.set(fullKey, localRecord);
            return localRecord.data;
          }
          window.localStorage.removeItem(fullKey);
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Clear cache entries with prefix.
   */
  static async clear(): Promise<void> {
    try {
      this.memoryStore.clear();

      if (typeof window !== 'undefined' && window.localStorage) {
        const toRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && k.startsWith(this.prefix)) toRemove.push(k);
        }
        toRemove.forEach((k) => window.localStorage.removeItem(k));
      }

      const db = await this.getDb();
      if (db) {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).clear();
        } finally {db.close();}
      }
    } catch {
      // ignore
    }
  }
}

// Backward-compatible alias for existing imports
export const LocalCacheService = CacheService;
