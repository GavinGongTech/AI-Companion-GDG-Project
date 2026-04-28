import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { cacheGet, cacheSet, cacheInvalidate, cacheClear, store, MAX_ENTRIES, SWEEP_INTERVAL_WRITES } from "./cache";

describe("cache service", () => {
  beforeEach(() => {
    cacheClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should set and get a value", () => {
    cacheSet("key1", "value1");
    expect(cacheGet("key1")).toBe("value1");
  });

  it("should return undefined for missing key", () => {
    expect(cacheGet("nonexistent")).toBeUndefined();
  });

  it("should expire values after TTL", () => {
    cacheSet("key1", "value1", 100);
    vi.advanceTimersByTime(101);
    expect(cacheGet("key1")).toBeUndefined();
    expect(store.has("key1")).toBe(false);
  });

  it("should delete key if set with TTL <= 0", () => {
    cacheSet("key1", "value1");
    cacheSet("key1", "value1", 0);
    expect(cacheGet("key1")).toBeUndefined();
    expect(store.has("key1")).toBe(false);
  });

  it("should refresh insertion order on get (LRU behavior)", () => {
    cacheSet("key1", "value1");
    cacheSet("key2", "value2");
    
    // key1 is oldest
    expect(store.keys().next().value).toBe("key1");
    
    cacheGet("key1");
    // now key2 is oldest
    expect(store.keys().next().value).toBe("key2");
  });

  it("should invalidate by exact key", () => {
    cacheSet("key1", "value1");
    cacheInvalidate("key1");
    expect(cacheGet("key1")).toBeUndefined();
  });

  it("should invalidate by prefix", () => {
    cacheSet("user:1:name", "Alice");
    cacheSet("user:1:email", "alice@example.com");
    cacheSet("user:2:name", "Bob");
    
    cacheInvalidate("user:1:");
    
    expect(cacheGet("user:1:name")).toBeUndefined();
    expect(cacheGet("user:1:email")).toBeUndefined();
    expect(cacheGet("user:2:name")).toBe("Bob");
  });

  it("should enforce capacity", () => {
    // We'll fill it up
    for (let i = 0; i < MAX_ENTRIES; i++) {
      cacheSet(`key${i}`, i);
    }
    expect(store.size).toBe(MAX_ENTRIES);
    
    // Add one more
    cacheSet("newKey", "newValue");
    expect(store.size).toBe(MAX_ENTRIES);
    expect(store.has("key0")).toBe(false); // First one added should be gone
    expect(store.has("newKey")).toBe(true);
  });

  it("should trigger sweep after enough writes", () => {
    cacheSet("expired", "val", 10);
    vi.advanceTimersByTime(20);
    
    // "expired" is still in store because it hasn't been got or swept
    expect(store.has("expired")).toBe(true);
    
    // Trigger sweep by making enough writes
    for (let i = 0; i < SWEEP_INTERVAL_WRITES; i++) {
      cacheSet(`key${i}`, i);
    }
    
    expect(store.has("expired")).toBe(false);
  });

  it("should handle empty store in enforceCapacity (edge case)", () => {
    // Force store.size to be > MAX_ENTRIES and keys().next().value to be undefined
    const sizeSpy = vi.spyOn(store, 'size', 'get').mockReturnValue(MAX_ENTRIES + 1);
    const keysSpy = vi.spyOn(store, 'keys').mockReturnValue({
      next: () => ({ value: undefined, done: true })
    } as any);

    cacheSet("trigger", "value");

    sizeSpy.mockRestore();
    keysSpy.mockRestore();
  });
});
