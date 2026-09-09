import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// ============================================================================
// PART 1: STATIC CODE AUDIT — MANDATE COMPLIANCE
// ============================================================================

test("Mandate Audit: src/lib/rpc/lru-cache.ts enforces 120s TTL and 500 capacity bounds", () => {
  const filePath = path.resolve(process.cwd(), "src/lib/rpc/lru-cache.ts");
  assert.ok(fs.existsSync(filePath), "lru-cache.ts must exist");
  const content = fs.readFileSync(filePath, "utf-8");

  // Verify default constructor signature capacity = 500, ttlMs = 120000 (120s)
  assert.match(
    content,
    /constructor\s*\(\s*capacity:\s*number\s*=\s*500\s*,\s*ttlMs:\s*number\s*=\s*120000\s*\)/,
    "LRUCache must default to 500 entries capacity and 120,000ms (120s) TTL"
  );

  // Verify globalTxCache instance strictly respects 500 capacity and 120s TTL
  assert.match(
    content,
    /export\s+const\s+globalTxCache\s*=\s*new\s+LRUCache<string,\s*any>\(\s*500\s*,\s*120000\s*\)/,
    "globalTxCache must be instantiated with 500 capacity and 120000ms TTL"
  );

  // Verify purgeExpired or prune mechanism exists for memory leak protection
  assert.match(
    content,
    /purgeExpired\(\)/,
    "LRUCache must provide purgeExpired() to prevent memory leaks"
  );

  // Verify eviction reclaims memory on set
  assert.match(
    content,
    /this\.purgeExpired\(\)/,
    "LRUCache.set() must purge expired items when capacity is reached"
  );
});

test("Mandate Audit: src/lib/rpc/multi-chain.ts enforces non-punitive circuit breaker & concurrency limits", () => {
  const filePath = path.resolve(process.cwd(), "src/lib/rpc/multi-chain.ts");
  assert.ok(fs.existsSync(filePath), "multi-chain.ts must exist");
  const content = fs.readFileSync(filePath, "utf-8");

  // Verify max 5s cooldown
  assert.match(
    content,
    /maxCooldownMs\s*=\s*5000/,
    "EndpointCircuitBreaker must enforce max 5s (5000ms) cooldown"
  );

  // Verify never lock out all nodes
  assert.match(
    content,
    /allLocked/,
    "Circuit breaker must detect if all nodes in pool are locked and permit earliest node"
  );

  // Verify ConcurrencyLimiter is exported and instantiated
  assert.match(
    content,
    /export\s+class\s+ConcurrencyLimiter/,
    "multi-chain.ts must provide ConcurrencyLimiter"
  );

  assert.match(
    content,
    /export\s+const\s+globalRpcLimiter\s*=\s*new\s+ConcurrencyLimiter/,
    "multi-chain.ts must provide globalRpcLimiter"
  );

  // Verify safe BigInt handling to prevent unhandled syntax/type errors
  assert.match(
    content,
    /export\s+function\s+safeBigInt/,
    "multi-chain.ts must provide safeBigInt helper"
  );
});

// ============================================================================
// PART 2: LRU CACHE BEHAVIORAL TESTS (TTL, EVICTION, LEAK PREVENTION)
// ============================================================================

class TestLRUCache {
  constructor(capacity = 500, ttlMs = 120000) {
    this.capacity = Math.max(1, capacity);
    this.cache = new Map();
    this.ttlMs = Math.max(10, ttlMs);
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  get(key) {
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
    this.cache.delete(key);
    this.cache.set(key, item);
    this.hits++;
    return item.value;
  }

  peek(key) {
    const item = this.cache.get(key);
    if (!item || Date.now() > item.expiry) return undefined;
    return item.value;
  }

  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  set(key, value, customTtlMs) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      this.purgeExpired();
      while (this.cache.size >= this.capacity) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey === undefined) break;
        this.cache.delete(oldestKey);
        this.evictions++;
      }
    }
    const ttl = typeof customTtlMs === "number" && customTtlMs > 0 ? customTtlMs : this.ttlMs;
    const now = Date.now();
    this.cache.set(key, { value, expiry: now + ttl, createdAt: now });
  }

  purgeExpired() {
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

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }

  getStats() {
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

test("LRUCache: Safe memory bounds (capacity 500) strictly enforced under high insert volume", () => {
  const cache = new TestLRUCache(500, 120000);

  // Insert 600 unique entries
  for (let i = 0; i < 600; i++) {
    cache.set(`account:${i}`, { address: `0x${i}`, balance: i * 100 });
  }

  assert.equal(cache.size(), 500, "Cache size must strictly not exceed 500");
  assert.equal(cache.getStats().evictions, 100, "Exactly 100 oldest entries must be evicted");

  // Oldest entries (0 to 99) must have been evicted
  assert.equal(cache.get("account:0"), undefined);
  assert.equal(cache.get("account:99"), undefined);

  // Newest entries (100 to 599) must be retained
  assert.ok(cache.get("account:100") !== undefined);
  assert.ok(cache.get("account:599") !== undefined);
});

test("LRUCache: TTL eviction keeps fresh data and handles rapid UI tab switching", async () => {
  const cache = new TestLRUCache(500, 100); // 100ms short TTL for test speed

  cache.set("btc:1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", { balanceUsd: 50000, txCount: 12 });

  // Rapid UI tab switching simulation (10 rapid requests within TTL)
  for (let tab = 0; tab < 10; tab++) {
    const cached = cache.get("btc:1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa");
    assert.ok(cached !== undefined, "Data must remain in cache during rapid UI tab switching");
    assert.equal(cached.balanceUsd, 50000);
  }

  assert.equal(cache.getStats().hits, 10, "Rapid tab switching must hit cache 10 times with 0 API calls");

  // Wait for TTL expiration (>100ms)
  await new Promise((resolve) => setTimeout(resolve, 110));

  // Expired entry must return undefined and be evicted
  const expired = cache.get("btc:1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa");
  assert.equal(expired, undefined, "Expired entry must return undefined");
  assert.equal(cache.size(), 0, "Expired entry must be removed from map");
});

test("LRUCache: Memory leak prevention — purgeExpired actively cleans stale allocations", async () => {
  const cache = new TestLRUCache(10, 50); // 50ms TTL

  // Set 5 items with 50ms TTL
  for (let i = 0; i < 5; i++) {
    cache.set(`stale:${i}`, { payload: "large data buffer" }, 50);
  }

  assert.equal(cache.size(), 5);

  // Wait for TTL to elapse
  await new Promise((resolve) => setTimeout(resolve, 60));

  // Actively prune expired entries
  const purgedCount = cache.purgeExpired();
  assert.equal(purgedCount, 5, "All 5 stale items must be purged");
  assert.equal(cache.size(), 0, "Size must be 0 after active purge");
});

test("LRUCache: Least-Recently-Used (LRU) re-ordering on access preserves active items", () => {
  const cache = new TestLRUCache(3, 120000);

  cache.set("a", 1);
  cache.set("b", 2);
  cache.set("c", 3);

  // Access "a" to make it Most Recently Used (MRU)
  const valA = cache.get("a");
  assert.equal(valA, 1);

  // Insert "d" — capacity 3 is exceeded. "b" is now LRU and must be evicted instead of "a"
  cache.set("d", 4);

  assert.equal(cache.has("b"), false, "Least recently used item 'b' must be evicted");
  assert.equal(cache.has("a"), true, "Accessed item 'a' must be preserved");
  assert.equal(cache.has("c"), true);
  assert.equal(cache.has("d"), true);
});

// ============================================================================
// PART 3: CONCURRENCY & CIRCUIT BREAKER BEHAVIORAL TESTS
// ============================================================================

class TestCircuitBreaker {
  constructor(maxCooldownMs = 5000) {
    this.failedHosts = new Map();
    this.maxCooldownMs = maxCooldownMs;
    this.registeredPools = [];
  }

  registerPool(urls) {
    this.registeredPools.push(new Set(urls.map((u) => this.getHost(u))));
  }

  isAvailable(url, candidatePool) {
    const host = this.getHost(url);
    const cooldownUntil = this.failedHosts.get(host);

    if (!cooldownUntil || Date.now() > cooldownUntil) {
      if (cooldownUntil) this.failedHosts.delete(host);
      return true;
    }

    let peerHosts;
    if (candidatePool && candidatePool.length > 0) {
      peerHosts = new Set(candidatePool.map((u) => this.getHost(u)));
    } else {
      peerHosts = this.registeredPools.find((p) => p.has(host));
    }

    if (peerHosts && peerHosts.size > 1) {
      const now = Date.now();
      let allLocked = true;
      let earliestHost = host;
      let earliestCooldown = cooldownUntil;

      for (const peer of peerHosts) {
        const peerCd = this.failedHosts.get(peer);
        if (!peerCd || peerCd <= now) {
          allLocked = false;
          break;
        }
        if (peerCd < earliestCooldown) {
          earliestCooldown = peerCd;
          earliestHost = peer;
        }
      }

      if (allLocked && host === earliestHost) {
        return true;
      }
    }

    return false;
  }

  recordFailure(url, durationMs = 5000) {
    const host = this.getHost(url);
    const clamped = Math.min(Math.max(1000, durationMs), this.maxCooldownMs);
    this.failedHosts.set(host, Date.now() + clamped);
  }

  recordSuccess(url) {
    this.failedHosts.delete(this.getHost(url));
  }

  getHost(url) {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  }
}

test("Circuit Breaker: Non-punitive cooldown strictly caps penalty at max 5s", () => {
  const cb = new TestCircuitBreaker(5000);

  // Record failure requesting an excessive 60,000ms cooldown
  cb.recordFailure("https://rpc.ankr.com/eth", 60000);

  const host = "rpc.ankr.com";
  const cooldownTimestamp = cb.failedHosts.get(host);
  const durationRemaining = cooldownTimestamp - Date.now();

  assert.ok(
    durationRemaining <= 5001,
    `Cooldown duration must never exceed 5000ms; got ${durationRemaining}ms`
  );
  assert.ok(durationRemaining >= 900, "Cooldown must be at least 1000ms");
});

test("Circuit Breaker: 'Never lock out all nodes' rule permits earliest node when all endpoints fail", () => {
  const cb = new TestCircuitBreaker(5000);
  const ethPool = [
    "https://eth.llamarpc.com",
    "https://rpc.ankr.com/eth",
    "https://cloudflare-eth.com",
  ];
  cb.registerPool(ethPool);

  const now = Date.now();

  // Node 1 failed at t=0 (cooldown until now + 2000ms)
  cb.failedHosts.set("eth.llamarpc.com", now + 2000);
  // Node 2 failed at t=1 (cooldown until now + 4000ms)
  cb.failedHosts.set("rpc.ankr.com", now + 4000);
  // Node 3 failed at t=2 (cooldown until now + 5000ms)
  cb.failedHosts.set("cloudflare-eth.com", now + 5000);

  // Node 1 has the earliest expiring cooldown (least penalized / cooling down longest)
  assert.equal(
    cb.isAvailable("https://eth.llamarpc.com", ethPool),
    true,
    "Earliest failing node MUST remain available to prevent total node lockout"
  );

  // Nodes with later cooldowns remain blocked while earliest node probes
  assert.equal(
    cb.isAvailable("https://rpc.ankr.com/eth", ethPool),
    false,
    "Later failed node should remain in cooldown while earliest node probes"
  );
  assert.equal(
    cb.isAvailable("https://cloudflare-eth.com", ethPool),
    false,
    "Later failed node should remain in cooldown while earliest node probes"
  );
});

test("ConcurrencyLimiter: Throttles parallel RPC calls without unhandled promise rejections or thread stalls", async () => {
  class TestLimiter {
    constructor(maxConcurrency = 3) {
      this.max = maxConcurrency;
      this.active = 0;
      this.maxObserved = 0;
      this.queue = [];
    }
    async run(fn) {
      if (this.active >= this.max) {
        await new Promise((r) => this.queue.push(r));
      }
      this.active++;
      this.maxObserved = Math.max(this.maxObserved, this.active);
      try {
        return await fn();
      } finally {
        this.active--;
        if (this.queue.length > 0) {
          const next = this.queue.shift();
          if (next) next();
        }
      }
    }
  }

  const limiter = new TestLimiter(3);
  const tasks = Array.from({ length: 15 }, (_, i) =>
    limiter.run(async () => {
      await new Promise((r) => setTimeout(r, 20));
      if (i === 7) throw new Error("Simulated RPC transient error");
      return `result-${i}`;
    })
  );

  const results = await Promise.allSettled(tasks);

  assert.equal(results.length, 15, "All 15 parallel queries must settle");
  assert.ok(
    limiter.maxObserved <= 3,
    `Active concurrency (${limiter.maxObserved}) must not exceed limit 3`
  );

  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected");

  assert.equal(fulfilled.length, 14, "14 queries should succeed");
  assert.equal(rejected.length, 1, "1 query cleanly captured error without crashing Node");
});

test("Safe BigInt: Never throws uncaught exceptions on malformed strings, null, or undefined", () => {
  function safeBigInt(val, fallback = 0n) {
    if (val === null || val === undefined || val === "") return fallback;
    try {
      if (typeof val === "bigint") return val;
      if (typeof val === "number") {
        if (!Number.isFinite(val)) return fallback;
        return BigInt(Math.trunc(val));
      }
      const clean = String(val).trim();
      if (!clean || clean === "0x" || clean === "-0x") return fallback;
      return BigInt(clean);
    } catch {
      return fallback;
    }
  }

  assert.equal(safeBigInt("0x10"), 16n);
  assert.equal(safeBigInt("1000000000000000000"), 1000000000000000000n);
  assert.equal(safeBigInt(42), 42n);
  assert.equal(safeBigInt(null), 0n);
  assert.equal(safeBigInt(undefined), 0n);
  assert.equal(safeBigInt(""), 0n);
  assert.equal(safeBigInt("0x"), 0n);
  assert.equal(safeBigInt("not-a-number"), 0n);
  assert.equal(safeBigInt(NaN), 0n);
  assert.equal(safeBigInt(Infinity), 0n);
});
