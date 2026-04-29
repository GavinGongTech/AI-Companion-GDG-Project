/**
 * Simple in-memory TTL cache for Firestore reads.
 * Single-process only — no shared state across workers.
 * Keys are scoped by caller (e.g. "courses:uid123").
 */

interface CacheEntry<T = any> {
  value: T;
  expiresAt: number;
}

export const store = new Map<string, CacheEntry>();

export const DEFAULT_TTL = 2 * 60 * 1000; // 2 minutes
export const MAX_ENTRIES = 5000;
export const SWEEP_INTERVAL_WRITES = 100;

let writesSinceSweep = 0;

function sweepExpired(now: number = Date.now()): void {
  for (const [key, entry] of store.entries()) {
    if (now > entry.expiresAt) {
      store.delete(key);
    }
  }
}

function enforceCapacity(): void {
  while (store.size > MAX_ENTRIES) {
    const oldestKey = store.keys().next().value;
    if (oldestKey === undefined) break;
    store.delete(oldestKey);
  }
}

/**
 * Clear the entire cache and reset counters.
 * ONLY FOR TESTING.
 */
export function cacheClear(): void {
  store.clear();
  writesSinceSweep = 0;
}

/**
 * Get a cached value if it exists and hasn't expired.
 * @param {string} key
 * @returns {any} The cached value, or undefined if missing/expired
 */
export function cacheGet<T = any>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  // Refresh insertion order so eviction is effectively LRU.
  store.delete(key);
  store.set(key, entry);
  return entry.value;
}

/**
 * Store a value with a TTL.
 * @param {string} key
 * @param {*} value
 * @param {number} [ttl] TTL in milliseconds (default 2 min)
 */
export function cacheSet<T = any>(key: string, value: T, ttl: number = DEFAULT_TTL): void {
  if (ttl <= 0) {
    store.delete(key);
    return;
  }
  store.set(key, { value, expiresAt: Date.now() + ttl });
  writesSinceSweep += 1;
  if (writesSinceSweep >= SWEEP_INTERVAL_WRITES) {
    writesSinceSweep = 0;
    sweepExpired();
  }
  enforceCapacity();
}

/**
 * Invalidate a specific key or all keys matching a prefix.
 * @param {string} keyOrPrefix
 */
export function cacheInvalidate(keyOrPrefix: string): void {
  if (store.has(keyOrPrefix)) {
    store.delete(keyOrPrefix);
    return;
  }
  // Prefix match — invalidate all keys starting with the prefix
  for (const key of store.keys()) {
    if (key.startsWith(keyOrPrefix)) {
      store.delete(key);
    }
  }
}
