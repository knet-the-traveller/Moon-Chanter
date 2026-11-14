interface CacheEntry<T> {
  timestamp: number;
  data: T;
  ttlMs: number;
}

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export class LocalCacheService {
  private static prefix = 'fieldshift_cache_';

  static get<T>(key: string): T | null {
    try {
      const itemStr = localStorage.getItem(this.prefix + key);
      if (!itemStr) return null;
      const entry: CacheEntry<T> = JSON.parse(itemStr);
      if (Date.now() - entry.timestamp > entry.ttlMs) {
        localStorage.removeItem(this.prefix + key);
        return null;
      }
      return entry.data;
    } catch {
      return null;
    }
  }

  static set<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
    try {
      const entry: CacheEntry<T> = {
        timestamp: Date.now(),
        data,
        ttlMs
      };
      localStorage.setItem(this.prefix + key, JSON.stringify(entry));
    } catch {
      // LocalStorage quota or access error handled gracefully
    }
  }

  static clear(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {
      // ignore
    }
  }
}
