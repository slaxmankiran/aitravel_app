/**
 * BoundedMap - A Map wrapper with max size (LRU eviction) and optional TTL.
 *
 * Prevents unbounded memory growth by evicting the least-recently-used entry
 * when the map exceeds maxSize. Optionally expires entries after ttlMs.
 */
export class BoundedMap<K, V> {
  private map = new Map<K, { value: V; createdAt: number; accessedAt: number }>();
  private readonly maxSize: number;
  private readonly ttlMs: number | null;

  constructor(opts: { maxSize: number; ttlMs?: number }) {
    this.maxSize = opts.maxSize;
    this.ttlMs = opts.ttlMs ?? null;
  }

  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;

    // Check TTL expiration
    if (this.ttlMs !== null && Date.now() - entry.createdAt > this.ttlMs) {
      this.map.delete(key);
      return undefined;
    }

    // Update access time for LRU tracking
    entry.accessedAt = Date.now();
    return entry.value;
  }

  set(key: K, value: V): this {
    // If key already exists, update in place
    if (this.map.has(key)) {
      const entry = this.map.get(key)!;
      entry.value = value;
      entry.createdAt = Date.now();
      entry.accessedAt = Date.now();
      return this;
    }

    // Evict LRU entry if at capacity
    if (this.map.size >= this.maxSize) {
      this.evictLRU();
    }

    this.map.set(key, {
      value,
      createdAt: Date.now(),
      accessedAt: Date.now(),
    });
    return this;
  }

  has(key: K): boolean {
    const entry = this.map.get(key);
    if (!entry) return false;

    // Check TTL expiration
    if (this.ttlMs !== null && Date.now() - entry.createdAt > this.ttlMs) {
      this.map.delete(key);
      return false;
    }
    return true;
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }

  /** Return non-expired keys */
  keys(): K[] {
    const result: K[] = [];
    const now = Date.now();
    const rawEntries = Array.from(this.map.entries());
    for (const [key, entry] of rawEntries) {
      if (this.ttlMs !== null && now - entry.createdAt > this.ttlMs) {
        this.map.delete(key);
        continue;
      }
      result.push(key);
    }
    return result;
  }

  /** Return non-expired values */
  values(): V[] {
    const result: V[] = [];
    const now = Date.now();
    const rawEntries = Array.from(this.map.entries());
    for (const [key, entry] of rawEntries) {
      if (this.ttlMs !== null && now - entry.createdAt > this.ttlMs) {
        this.map.delete(key);
        continue;
      }
      result.push(entry.value);
    }
    return result;
  }

  /** Return non-expired [key, value] pairs */
  entries(): [K, V][] {
    const result: [K, V][] = [];
    const now = Date.now();
    const rawEntries = Array.from(this.map.entries());
    for (const [key, entry] of rawEntries) {
      if (this.ttlMs !== null && now - entry.createdAt > this.ttlMs) {
        this.map.delete(key);
        continue;
      }
      result.push([key, entry.value]);
    }
    return result;
  }

  forEach(callback: (value: V, key: K) => void): void {
    const now = Date.now();
    const rawEntries = Array.from(this.map.entries());
    for (const [key, entry] of rawEntries) {
      if (this.ttlMs !== null && now - entry.createdAt > this.ttlMs) {
        this.map.delete(key);
        continue;
      }
      callback(entry.value, key);
    }
  }

  private evictLRU(): void {
    let oldestKey: K | null = null;
    let oldestAccess = Infinity;

    const rawEntries = Array.from(this.map.entries());
    for (const [key, entry] of rawEntries) {
      if (entry.accessedAt < oldestAccess) {
        oldestAccess = entry.accessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey !== null) {
      this.map.delete(oldestKey);
    }
  }
}
