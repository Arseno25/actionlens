import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TtlCache } from "../src/cache/ttlCache";

describe("TtlCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns set values within TTL", () => {
    const cache = new TtlCache<string, number>(1000);
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
  });

  it("expires values after TTL", () => {
    const cache = new TtlCache<string, number>(500);
    cache.set("a", 1);
    vi.advanceTimersByTime(600);
    expect(cache.get("a")).toBeUndefined();
  });

  it("respects per-call TTL override", () => {
    const cache = new TtlCache<string, number>(60_000);
    cache.set("a", 1, 100);
    vi.advanceTimersByTime(150);
    expect(cache.get("a")).toBeUndefined();
  });

  it("size() evicts expired entries", () => {
    const cache = new TtlCache<string, number>(1000);
    cache.set("a", 1, 100);
    cache.set("b", 2, 2000);
    vi.advanceTimersByTime(500);
    expect(cache.size()).toBe(1);
  });

  it("clear empties the cache", () => {
    const cache = new TtlCache<string, number>();
    cache.set("a", 1);
    cache.set("b", 2);
    cache.clear();
    expect(cache.size()).toBe(0);
  });
});
