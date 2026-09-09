import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

// Pure SHA-256 Implementation under test
function rotr(n, b) {
  return (n >>> b) | (n << (32 - b));
}

function computeSha256Digest(input) {
  const bytes = new TextEncoder().encode(input);
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const bitLen = bytes.length * 8;
  const newLen = ((bytes.length + 8) >> 6) + 1 << 6;
  const padded = new Uint8Array(newLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(newLen - 4, bitLen >>> 0, false);
  view.setUint32(newLen - 8, Math.floor(bitLen / 0x100000000), false);

  const w = new Uint32Array(64);

  for (let i = 0; i < newLen; i += 64) {
    for (let j = 0; j < 16; j++) {
      w[j] = view.getUint32(i + j * 4, false);
    }
    for (let j = 16; j < 64; j++) {
      const s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

    for (let j = 0; j < 64; j++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ ((~e) & g);
      const temp1 = (h + s1 + ch + K[j] + w[j]) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const hex = (n) => (n >>> 0).toString(16).padStart(8, "0");
  return `${hex(h0)}${hex(h1)}${hex(h2)}${hex(h3)}${hex(h4)}${hex(h5)}${hex(h6)}${hex(h7)}`;
}

// Canonical graph pre-image generator
function computeCanonicalGraphHash(graph) {
  const rawNodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const rawEdges = Array.isArray(graph?.edges) ? graph.edges : [];

  const canonicalNodes = rawNodes
    .map((n) => ({
      id: (n.id || n.fullAddress || "").trim().toLowerCase(),
      inflow: Math.round((n.totalInflowUsd || 0) * 100) / 100,
      outflow: Math.round((n.totalOutflowUsd || 0) * 100) / 100,
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const canonicalEdges = rawEdges
    .map((e) => ({
      amount: Math.round((e.amount || 0) * 100) / 100,
      source: (e.source || "").trim().toLowerCase(),
      target: (e.target || "").trim().toLowerCase(),
      token: (e.tokenSymbol || "USDT").trim().toUpperCase(),
      txHash: (e.txHash || "").trim().toLowerCase(),
    }))
    .sort((a, b) => {
      const keyA = `${a.source}_${a.target}_${a.txHash}_${a.amount}`;
      const keyB = `${b.source}_${b.target}_${b.txHash}_${b.amount}`;
      return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
    });

  const preImagePayload = {
    algorithm: "SHA-256",
    complianceStatute: "BSA-2023-SEC-63",
    edges: canonicalEdges,
    network: (graph?.network || "ETH").trim().toUpperCase(),
    nodes: canonicalNodes,
    root: (graph?.rootAddress || canonicalNodes[0]?.id || "").trim().toLowerCase(),
  };

  const canonicalString = JSON.stringify(preImagePayload);
  return computeSha256Digest(canonicalString);
}

function verifyCertificate(traceResult, expectedHash) {
  const computedHash = computeCanonicalGraphHash(traceResult);
  const cleanExpected = (expectedHash || traceResult.sha256StateHash || "").toLowerCase().trim();
  const cleanComputed = computedHash.toLowerCase().trim();

  let bitsTampered = 0;
  if (cleanExpected.length === 64 && cleanComputed.length === 64) {
    for (let i = 0; i < 64; i++) {
      const expectedNibble = parseInt(cleanExpected[i], 16) || 0;
      const computedNibble = parseInt(cleanComputed[i], 16) || 0;
      const xor = expectedNibble ^ computedNibble;
      bitsTampered += (xor & 1) + ((xor >> 1) & 1) + ((xor >> 2) & 1) + ((xor >> 3) & 1);
    }
  } else {
    bitsTampered = cleanExpected === cleanComputed ? 0 : 256;
  }

  const verified = cleanExpected.length === 64 && cleanExpected === cleanComputed && bitsTampered === 0;

  return {
    verified,
    computedHash: cleanComputed,
    expectedHash: cleanExpected,
    bitsTampered,
    algorithm: "SHA-256 (FIPS PUB 180-4 / RFC 8785)",
    statutoryAdmissibility: verified
      ? "ADMISSIBLE UNDER SECTION 63 BHARATIYA SAKSHYA ADHINIYAM (BSA, 2023)"
      : "INADMISSIBLE — HASH MISMATCH / STATE TAMPERING DETECTED",
  };
}

// ============================================================================
// TEST SUITE: SECTION 63 BSA 2023 FORENSIC CERTIFICATION & DETERMINISM
// ============================================================================

test("BSA §63 Mandate 1: Pure FIPS PUB 180-4 SHA-256 matches node:crypto 100%", () => {
  const testVectors = [
    "",
    "a",
    "abc",
    "Section 63 Bharatiya Sakshya Adhiniyam, 2023",
    JSON.stringify({ test: "canonical", amount: 147058.82, nodes: ["0x1", "0x2"] }),
  ];

  for (const v of testVectors) {
    const pure = computeSha256Digest(v);
    const node = crypto.createHash("sha256").update(Buffer.from(v, "utf8")).digest("hex");
    assert.equal(pure, node, `SHA-256 digest mismatch for vector: ${v}`);
    assert.equal(pure.length, 64);
    assert.match(pure, /^[0-9a-f]{64}$/);
  }
});

test("BSA §63 Mandate 2: Graph State Hash Determinism & Idempotency", () => {
  const sampleGraph = {
    rootAddress: "0x71c55b9a2b7252277d33b5cde4c8a60e0a5d262f",
    network: "ETH",
    nodes: [
      { id: "0x71c55b9a2b7252277d33b5cde4c8a60e0a5d262f", totalInflowUsd: 100000, totalOutflowUsd: 100000 },
      { id: "0x98a55b9a2b7252277d33b5cde4c8a60e0a5d3311", totalInflowUsd: 100000, totalOutflowUsd: 100000 },
      { id: "0x4e9ce36e442e55ecd9025b9a6e0d88485d628a67", totalInflowUsd: 100000, totalOutflowUsd: 0 },
    ],
    edges: [
      { source: "0x71c55b9a2b7252277d33b5cde4c8a60e0a5d262f", target: "0x98a55b9a2b7252277d33b5cde4c8a60e0a5d3311", amount: 100000, txHash: "0xaaa", tokenSymbol: "USDT" },
      { source: "0x98a55b9a2b7252277d33b5cde4c8a60e0a5d3311", target: "0x4e9ce36e442e55ecd9025b9a6e0d88485d628a67", amount: 100000, txHash: "0xbbb", tokenSymbol: "USDT" },
    ],
  };

  const hash1 = computeCanonicalGraphHash(sampleGraph);
  const hash2 = computeCanonicalGraphHash(sampleGraph);
  assert.equal(hash1, hash2, "Re-hashing identical graph must yield identical 64-char hex digest");
  assert.equal(hash1.length, 64);
  assert.match(hash1, /^[0-9a-f]{64}$/);
});

test("BSA §63 Mandate 2: Order-Invariance across Permuted Nodes and Edges", () => {
  const nodeA = { id: "0x1111111111111111111111111111111111111111", totalInflowUsd: 50000, totalOutflowUsd: 50000 };
  const nodeB = { id: "0x2222222222222222222222222222222222222222", totalInflowUsd: 50000, totalOutflowUsd: 50000 };
  const nodeC = { id: "0x3333333333333333333333333333333333333333", totalInflowUsd: 50000, totalOutflowUsd: 0 };

  const edge1 = { source: nodeA.id, target: nodeB.id, amount: 50000, txHash: "0x123", tokenSymbol: "USDT" };
  const edge2 = { source: nodeB.id, target: nodeC.id, amount: 50000, txHash: "0x456", tokenSymbol: "USDT" };

  const graphOriginal = {
    rootAddress: nodeA.id,
    network: "ETH",
    nodes: [nodeA, nodeB, nodeC],
    edges: [edge1, edge2],
  };

  const graphPermuted = {
    rootAddress: nodeA.id,
    network: "ETH",
    nodes: [nodeC, nodeA, nodeB], // Permuted order
    edges: [edge2, edge1],         // Permuted order
  };

  const hashOriginal = computeCanonicalGraphHash(graphOriginal);
  const hashPermuted = computeCanonicalGraphHash(graphPermuted);

  assert.equal(hashOriginal, hashPermuted, "Canonical sorting must produce identical hash regardless of node/edge array order");
});

test("BSA §63 Mandate 2: Case Invariance for Ledger Addresses", () => {
  const graphLower = {
    rootAddress: "0xabcdef1234567890abcdef1234567890abcdef12",
    network: "ETH",
    nodes: [{ id: "0xabcdef1234567890abcdef1234567890abcdef12", totalInflowUsd: 100, totalOutflowUsd: 0 }],
    edges: [],
  };

  const graphUpper = {
    rootAddress: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
    network: "eth",
    nodes: [{ id: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12", totalInflowUsd: 100, totalOutflowUsd: 0 }],
    edges: [],
  };

  assert.equal(computeCanonicalGraphHash(graphLower), computeCanonicalGraphHash(graphUpper), "Hex addresses must be normalized case-insensitively");
});

test("BSA §63 Mandate 2: Cryptographic Avalanche Effect on 1-Bit State Mutation", () => {
  const baseGraph = {
    rootAddress: "0x71c55b9a2b7252277d33b5cde4c8a60e0a5d262f",
    network: "ETH",
    nodes: [{ id: "0x71c55b9a2b7252277d33b5cde4c8a60e0a5d262f", totalInflowUsd: 100000, totalOutflowUsd: 100000 }],
    edges: [{ source: "0x71c55b9a2b7252277d33b5cde4c8a60e0a5d262f", target: "0x98a55b9a2b7252277d33b5cde4c8a60e0a5d3311", amount: 100000.00, txHash: "0xaaa", tokenSymbol: "USDT" }],
  };

  // Mutate amount by $0.01
  const mutatedGraph = {
    ...baseGraph,
    edges: [{ ...baseGraph.edges[0], amount: 100000.01 }],
  };

  const baseHash = computeCanonicalGraphHash(baseGraph);
  const mutatedHash = computeCanonicalGraphHash(mutatedGraph);

  assert.notEqual(baseHash, mutatedHash, "1-bit mutation must produce completely different hash");

  // Calculate bit divergence (Hamming distance)
  let diffBits = 0;
  for (let i = 0; i < 64; i++) {
    const b1 = parseInt(baseHash[i], 16);
    const b2 = parseInt(mutatedHash[i], 16);
    let xor = b1 ^ b2;
    while (xor > 0) {
      diffBits += xor & 1;
      xor >>= 1;
    }
  }

  assert.ok(diffBits > 80, `Avalanche effect must alter significant bit entropy (observed ${diffBits}/256 bits flipped)`);
});

test("BSA §63 Mandate 3: Verification Function validates authentic court record with 0 bits tampered", () => {
  const authenticGraph = {
    rootAddress: "TY7kL9w4NxQ2rJ1v8mP5s3e7t9a2m4b6cD",
    network: "TRON",
    nodes: [
      { id: "TY7kL9w4NxQ2rJ1v8mP5s3e7t9a2m4b6cD", totalInflowUsd: 147058.82, totalOutflowUsd: 147058.82 },
      { id: "TV9mK8w7NxQ4rJ2v1mP8s5e3t1a7m9b2cD", totalInflowUsd: 147058.82, totalOutflowUsd: 147058.82 },
    ],
    edges: [
      { source: "TY7kL9w4NxQ2rJ1v8mP5s3e7t9a2m4b6cD", target: "TV9mK8w7NxQ4rJ2v1mP8s5e3t1a7m9b2cD", amount: 147058.82, txHash: "0x9a8b", tokenSymbol: "USDT" },
    ],
  };

  const authenticHash = computeCanonicalGraphHash(authenticGraph);
  const report = verifyCertificate(authenticGraph, authenticHash);

  assert.equal(report.verified, true);
  assert.equal(report.bitsTampered, 0);
  assert.equal(report.computedHash, authenticHash);
  assert.equal(report.expectedHash, authenticHash);
  assert.equal(report.statutoryAdmissibility, "ADMISSIBLE UNDER SECTION 63 BHARATIYA SAKSHYA ADHINIYAM (BSA, 2023)");
});

test("BSA §63 Mandate 3: Verification Function rejects tampered graph state with non-zero bits tampered", () => {
  const authenticGraph = {
    rootAddress: "TY7kL9w4NxQ2rJ1v8mP5s3e7t9a2m4b6cD",
    network: "TRON",
    nodes: [
      { id: "TY7kL9w4NxQ2rJ1v8mP5s3e7t9a2m4b6cD", totalInflowUsd: 147058.82, totalOutflowUsd: 147058.82 },
    ],
    edges: [],
  };

  const authenticHash = computeCanonicalGraphHash(authenticGraph);

  // Counterfeit transaction injection
  const tamperedGraph = {
    ...authenticGraph,
    nodes: [
      ...authenticGraph.nodes,
      { id: "0xHackerCompromisedNode", totalInflowUsd: 999999, totalOutflowUsd: 0 },
    ],
  };

  const report = verifyCertificate(tamperedGraph, authenticHash);

  assert.equal(report.verified, false);
  assert.ok(report.bitsTampered > 0);
  assert.notEqual(report.computedHash, authenticHash);
  assert.equal(report.statutoryAdmissibility, "INADMISSIBLE — HASH MISMATCH / STATE TAMPERING DETECTED");
});
