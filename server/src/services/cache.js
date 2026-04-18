/**
 * Simple in-memory TTL cache for Firestore reads.
 * Single-process only — no shared state across workers.
 * Keys are scoped by caller (e.g. "courses:uid123").
 */

const store = new Map();

const DEFAULT_TTL = 2 * 60 * 1000; // 2 minutes
const MAX_ENTRIES = 5000;
const SWEEP_INTERVAL_WRITES = 100;

let writesSinceSweep = 0;

function sweepExpired(now = Date.now()) {
  for (const [key, entry] of store.entries()) {
    if (now > entry.expiresAt) {
      store.delete(key);
    }
  }
}

function enforceCapacity() {
  while (store.size > MAX_ENTRIES) {
    const oldestKey = store.keys().next().value;
    if (oldestKey === undefined) break;
    store.delete(oldestKey);
  }
}

/**
 * Get a cached value if it exists and hasn't expired.
 * @param {string} key
 * @returns {*} The cached value, or undefined if missing/expired
 */
export function cacheGet(key) {
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
export function cacheSet(key, value, ttl = DEFAULT_TTL) {
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
export function cacheInvalidate(keyOrPrefix) {
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
