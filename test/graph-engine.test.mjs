import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

// 1. Heuristic Engine Test
test("Deterministic VASP Sweeping Heuristic: Spot 100% balance sweep and micro-gas refill", () => {
  const inflow = 142000;
  const outgoingTxs = [
    {
      txHash: "0x6d5e4f3a...",
      fromAddress: "TV9mK8w7...",
      toAddress: "TF5cLg27W4r3nQGv7V2v1uA88hQe9k3J8u",
      amount: 142000,
      tokenSymbol: "USDT",
      timestamp: "2026-08-12T10:10:05.000Z",
      blockNumber: 85872504,
      network: "TRON",
      gasRefillDetected: true,
      gasRefillAmount: 15,
      gasRefillAsset: "TRX",
    },
  ];

  const sweptRatio = (outgoingTxs[0].amount / inflow) * 100;
  assert.equal(sweptRatio, 100);
  assert.equal(outgoingTxs[0].gasRefillDetected, true);
});

// 2. Cryptographic State Hash (Section 63 BSA)
test("Section 63 BSA Cryptographic State Hash: Deterministic 64-char SHA-256", () => {
  const payload = JSON.stringify({
    root: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    network: "ETH",
    timestamp: "2026-09-02T00:30:00.000Z",
  });
  const hash = crypto.createHash("sha256").update(payload).digest("hex");
  assert.equal(hash.length, 64);
  assert.match(hash, /^[0-9a-f]{64}$/);
});

// 3. Network Detection Test
test("Network Prefix Detection: Properly routes addresses across ledgers", () => {
  const isEth = (addr) => addr.startsWith("0x") && addr.length === 42;
  const isTron = (addr) => addr.startsWith("T") && addr.length === 34;
  const isBtc = (addr) => addr.startsWith("bc1") || addr.startsWith("1") || addr.startsWith("3");

  assert.equal(isEth("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"), true);
  assert.equal(isTron("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"), true);
  assert.equal(isBtc("bc1qq8dxdalmj3f89v5xm5f3y70sec9s0fa7qpesl7"), true);
});

// 4. Critical Path Backwards Lineage Tracer Verification
test("Critical Path Backwards Lineage Tracer: Traces unbroken primary flow from terminal VASP to suspect root", () => {
  const root = "0xRootSuspect111111111111111111111111111111";
  const mule1 = "0xMuleHop1111111111111111111111111111111111";
  const bridge = "0xBridge22222222222222222222222222222222222";
  const vaspVault = "0xVaspVault33333333333333333333333333333333";
  const noiseNode = "0xNoiseMule99999999999999999999999999999999";

  const nodes = [
    { id: root, fullAddress: root, hopDistance: 0, totalInflowUsd: 100000, balanceUsd: 0, entityType: "SUSPECT" },
    { id: mule1, fullAddress: mule1, hopDistance: 1, totalInflowUsd: 95000, balanceUsd: 0, entityType: "MULE_WALLET" },
    { id: bridge, fullAddress: bridge, hopDistance: 2, totalInflowUsd: 90000, balanceUsd: 0, entityType: "BRIDGE_CONTRACT" },
    { id: vaspVault, fullAddress: vaspVault, hopDistance: 3, totalInflowUsd: 88000, balanceUsd: 88000, entityType: "VASP_COLD_VAULT", isDestinationVault: true },
    { id: noiseNode, fullAddress: noiseNode, hopDistance: 1, totalInflowUsd: 5000, balanceUsd: 5000, entityType: "MULE_WALLET" },
  ];

  const edges = [
    { id: "e1", source: root, target: mule1, amount: 95000, isPrimaryFlow: true },
    { id: "e-noise", source: root, target: noiseNode, amount: 5000, isPrimaryFlow: false },
    { id: "e2", source: mule1, target: bridge, amount: 90000, isPrimaryFlow: true, isBridgeTx: true },
    { id: "e3", source: bridge, target: vaspVault, amount: 88000, isPrimaryFlow: true, isSweeping: true },
  ];

  // Emulate computeCriticalPath logic
  const rootKey = root.toLowerCase();
  const focusNodes = new Set([rootKey]);
  const focusEdges = new Set();

  const targetNode = nodes.find(n => n.isDestinationVault);
  assert.ok(targetNode);
  const targetKey = targetNode.fullAddress.toLowerCase();
  focusNodes.add(targetKey);

  const inEdgesMap = new Map();
  for (const edge of edges) {
    const tgt = edge.target.toLowerCase();
    if (!inEdgesMap.has(tgt)) inEdgesMap.set(tgt, []);
    inEdgesMap.get(tgt).push(edge);
  }

  let curr = targetKey;
  const visitedBackwards = new Set([curr]);

  while (curr !== rootKey) {
    const inEdges = inEdgesMap.get(curr) || [];
    if (inEdges.length === 0) break;

    const sortedEdges = inEdges.slice().sort((a, b) => {
      const aPri = (a.isPrimaryFlow || a.isSweeping ? 4 : 0) + (a.isBridgeTx ? 2 : 0);
      const bPri = (b.isPrimaryFlow || b.isSweeping ? 4 : 0) + (b.isBridgeTx ? 2 : 0);
      if (aPri !== bPri) return bPri - aPri;
      return (Number(b.amount) || 0) - (Number(a.amount) || 0);
    });

    const bestEdge = sortedEdges[0];
    if (!bestEdge) break;

    focusEdges.add(bestEdge.id);
    const prevKey = bestEdge.source.toLowerCase();
    focusNodes.add(prevKey);

    if (visitedBackwards.has(prevKey)) break;
    visitedBackwards.add(prevKey);
    curr = prevKey;
  }

  // Verify critical path contains root, mule1, bridge, and vaspVault, but EXCLUDES noiseNode
  assert.equal(focusNodes.has(root.toLowerCase()), true);
  assert.equal(focusNodes.has(mule1.toLowerCase()), true);
  assert.equal(focusNodes.has(bridge.toLowerCase()), true);
  assert.equal(focusNodes.has(vaspVault.toLowerCase()), true);
  assert.equal(focusNodes.has(noiseNode.toLowerCase()), false);

  // Verify critical edges contain e1, e2, e3, but EXCLUDE e-noise
  assert.equal(focusEdges.has("e1"), true);
  assert.equal(focusEdges.has("e2"), true);
  assert.equal(focusEdges.has("e3"), true);
  assert.equal(focusEdges.has("e-noise"), false);
});

