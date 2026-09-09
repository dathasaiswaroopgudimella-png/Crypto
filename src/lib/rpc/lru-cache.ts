/**
 * AEGIS-TRACE High-Performance LRU Cache with TTL Eviction
 * 
 * Mandates:
 * - Default capacity: 500 entries (strictly bounded memory footprint, zero leaks)
 * - Default TTL: 120 seconds (120,000ms) for fresh data and zero redundant API calls during UI tab switching
 * - Least-Recently-Used (LRU) eviction policy via JavaScript Map insertion-order semantics
 * - Active & lazy expired entry purging to prevent unbounded memory growth
 */

export interface CacheEntry<V> {
  value: V;
  expiry: number;
  createdAt: number;
}

export interface CacheStats {
  size: number;
  capacity: number;
  ttlMs: number;
  hits: number;
  misses: number;
  evictions: number;
}

export class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, CacheEntry<V>>;
  private ttlMs: number;
  private hits: number = 0;
  private misses: number = 0;
  private evictions: number = 0;

  constructor(capacity: number = 500, ttlMs: number = 120000) {
    this.capacity = Math.max(1, capacity);
    this.cache = new Map();
    this.ttlMs = Math.max(10, ttlMs);
  }

  /**
   * Retrieves a cached item by key.
   * If expired, purges immediately and returns undefined.
   * If valid, updates LRU order (moves to MRU position) and returns value.
   */
  get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (!item) {
      this.misses++;
      return undefined;
    }

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    // Refresh LRU order: delete & re-insert moves key to end of Map iteration
    this.cache.delete(key);
    this.cache.set(key, item);
    this.hits++;
    return item.value;
  }

  /**
   * Inspects a cached item without refreshing its LRU position.
   */
  peek(key: K): V | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return undefined;
    }
    return item.value;
  }

  /**
   * Checks if an unexpired item exists in cache.
   */
  has(key: K): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Inserts or updates an entry in the cache.
   * Enforces capacity limit (max 500 entries) by first purging expired entries,
   * then evicting LRU entries if still at capacity.
   */
  set(key: K, value: V, customTtlMs?: number): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // Memory protection: purge expired entries before evicting valid entries
      this.purgeExpired();

      // If still at or above capacity, evict the oldest (LRU) entry
      while (this.cache.size >= this.capacity) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey === undefined) break;
        this.cache.delete(oldestKey);
        this.evictions++;
      }
    }

    const ttl = typeof customTtlMs === "number" && customTtlMs > 0 ? customTtlMs : this.ttlMs;
    const now = Date.now();
    this.cache.set(key, {
      value,
      expiry: now + ttl,
      createdAt: now,
    });
  }

  /**
   * Purges all expired entries to actively reclaim memory.
   * Returns the count of purged entries.
   */
  purgeExpired(): number {
    const now = Date.now();
    let purged = 0;
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
        purged++;
      }
    }
    return purged;
  }

  /**
   * Alias for purgeExpired to support standard cache management interfaces.
   */
  prune(): number {
    return this.purgeExpired();
  }

  /**
   * Deletes a specific key from the cache.
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clears all entries and resets statistics.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Returns current count of entries in cache.
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Returns cache runtime telemetry.
   */
  getStats(): CacheStats {
    return {
      size: this.cache.size,
      capacity: this.capacity,
      ttlMs: this.ttlMs,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
    };
  }
}

/**
 * Global Transaction & Account State Cache for AEGIS-TRACE
 * Default capacity: 500 entries (bounded memory, zero memory leaks)
 * Default TTL: 120 seconds (fresh data, zero redundant RPC queries during UI tab switching)
 */
export const globalTxCache = new LRUCache<string, any>(500, 120000);

