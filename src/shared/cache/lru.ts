import { LRUCache } from "lru-cache";

type CacheValue = Record<string, unknown>;

const caches = new Map<string, LRUCache<string, CacheValue>>();

export function getCache(name: string, max = 500, ttlMs = 60_000) {
  const existing = caches.get(name);
  if (existing) return existing;

  const cache = new LRUCache<string, CacheValue>({ max, ttl: ttlMs });
  caches.set(name, cache);
  return cache;
}

export function cacheKey(...parts: (string | number | undefined | null)[]) {
  return parts.filter((p) => p != null && p !== "").join(":");
}

export function cacheGet<T>(cache: LRUCache<string, CacheValue>, key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function cacheSet(cache: LRUCache<string, CacheValue>, key: string, value: CacheValue) {
  cache.set(key, value);
}

export function cacheDel(cache: LRUCache<string, CacheValue>, key: string) {
  cache.delete(key);
}

export function clearCache(name: string) {
  caches.get(name)?.clear();
}
