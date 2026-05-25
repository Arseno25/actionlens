interface Entry<V> {
  value: V;
  expiresAt: number;
}

export class TtlCache<K, V> {
  private readonly map = new Map<K, Entry<V>>();
  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs = 60_000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: K, value: V, ttlMs: number = this.defaultTtlMs): void {
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: K): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  /** Number of *non-expired* entries (also evicts expired ones as a side-effect). */
  size(): number {
    const now = Date.now();
    for (const [k, v] of this.map) {
      if (v.expiresAt <= now) this.map.delete(k);
    }
    return this.map.size;
  }
}
