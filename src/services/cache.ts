/**
 * Resilient Cache Service with IndexedDB, localStorage, and In-Memory tiers.
 * Guaranteed to never throw into callers.
 */

interface CacheRecord<T> {
  timestamp: number;
  ttlMs: number;
  data: T;
}

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const DB_NAME = 'FieldShiftCacheDB';
const STORE_NAME = 'climateCache';
const DB_VERSION = 1;

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
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
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
        if (now - memRecord.timestamp > memRecord.ttlMs) {
          this.memoryStore.delete(fullKey);
        } else {
          return memRecord.data;
        }
      }

      // 2. Check IndexedDB if available
      const db = await this.getDb();
      if (db) {
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
          if (now - idbRecord.timestamp > idbRecord.ttlMs) {
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
      }

      // 3. Check localStorage fallback
      if (typeof window !== 'undefined' && window.localStorage) {
        const itemStr = window.localStorage.getItem(fullKey);
        if (itemStr) {
          const localRecord: CacheRecord<T> = JSON.parse(itemStr);
          if (now - localRecord.timestamp > localRecord.ttlMs) {
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
        await new Promise<void>((resolve) => {
          try {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.put({ key: fullKey, payload: record });
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
          } catch {
            resolve();
          }
        });
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
        if (now - memRecord.timestamp <= memRecord.ttlMs) {
          return memRecord.data;
        }
        this.memoryStore.delete(fullKey);
      }

      if (typeof window !== 'undefined' && window.localStorage) {
        const itemStr = window.localStorage.getItem(fullKey);
        if (itemStr) {
          const localRecord: CacheRecord<T> = JSON.parse(itemStr);
          if (now - localRecord.timestamp <= localRecord.ttlMs) {
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
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
      }
    } catch {
      // ignore
    }
  }
}

// Backward-compatible alias for existing imports
export const LocalCacheService = CacheService;
