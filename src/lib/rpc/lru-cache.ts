export class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, { value: V; expiry: number }>;
  private ttlMs: number;

  constructor(capacity: number = 500, ttlMs: number = 60000) {
    this.capacity = capacity;
    this.cache = new Map();
    this.ttlMs = ttlMs;
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }

  set(key: K, value: V, customTtlMs?: number): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    const expiry = Date.now() + (customTtlMs ?? this.ttlMs);
    this.cache.set(key, { value, expiry });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export const globalTxCache = new LRUCache<string, any>(1000, 180000);
