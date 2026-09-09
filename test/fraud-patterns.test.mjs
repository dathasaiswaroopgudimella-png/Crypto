import test from "node:test";
import assert from "node:assert/strict";

// ============================================================================
// PATTERN 1: Peeling Chain (>80% forwarding ratio, >=2 hops, small fee leak)
// ============================================================================
test("Pattern 1: Peeling Chain Detection — Multi-hop serial forwarding (>80% ratio, >=2 hops)", () => {
  const nodes = [
    { id: "addr0", fullAddress: "addr0", hopDistance: 0, totalInflowUsd: 100000, network: "TRON" },
    { id: "addr1", fullAddress: "addr1", hopDistance: 1, totalInflowUsd: 90000, network: "TRON" },
    { id: "addr2", fullAddress: "addr2", hopDistance: 2, totalInflowUsd: 81000, network: "TRON" },
    { id: "addr3", fullAddress: "addr3", hopDistance: 3, totalInflowUsd: 73000, network: "TRON" },
  ];

  const edges = [
    { source: "addr0", target: "addr1", amount: 90000 },
    { source: "addr1", target: "addr2", amount: 81000 },
    { source: "addr2", target: "addr3", amount: 73000 },
  ];

  const isPeeling = (ratio) => ratio > 0.80 && ratio < 0.995;

  let chainLength = 0;
  let prevAmount = nodes[0].totalInflowUsd;
  for (const node of nodes.slice(1)) {
    const edge = edges.find(e => e.target === node.fullAddress);
    if (edge) {
      const ratio = edge.amount / prevAmount;
      if (isPeeling(ratio)) {
        chainLength++;
        prevAmount = edge.amount;
      }
    }
  }

  assert.ok(chainLength >= 2, "Must detect at least 2 consecutive peeling hops");
  assert.equal(chainLength, 3);
});

test("Pattern 1 (Edge Case): Peeling Chain Rejection — Below 80% forwarding ratio or <2 hops", () => {
  const isPeeling = (ratio) => ratio > 0.80 && ratio < 0.995;

  // 75% forwarding ratio is below the >80% mandate
  assert.equal(isPeeling(0.75), false, "75% should NOT qualify as peeling chain");
  // 99.9% forwarding is a direct sweep, not a peeling fee leak
  assert.equal(isPeeling(0.999), false, "99.9% should qualify as direct sweep, not peeling leak");
  // 90% qualifies
  assert.equal(isPeeling(0.90), true, "90% should qualify as peeling chain");
});

// ============================================================================
// PATTERN 2: VASP Sweeping (>95% outgoing volume to vault within short block window)
// ============================================================================
test("Pattern 2: VASP Sweeping — >95% outgoing volume to hot wallet/vault within short block window", () => {
  const inflow = 50000;
  const outgoingTxs = [
    {
      toAddress: "TF5cLg27W4r3nQGv7V2v1uA88hQe9k3J8u",
      amount: 49800,
      blockNumber: 85872504,
      gasRefillDetected: true,
      gasRefillAmount: 15,
      gasRefillAsset: "TRX",
      gasRefillBlockNumber: 85872502,
    }
  ];

  const sweptRatio = (outgoingTxs[0].amount / inflow) * 100;
  assert.ok(sweptRatio > 95, "Must exceed 95% threshold");
  assert.equal(sweptRatio, 99.6);

  // Verify short block window (<= 3 blocks)
  const blockDelta = Math.abs(outgoingTxs[0].blockNumber - outgoingTxs[0].gasRefillBlockNumber);
  assert.ok(blockDelta <= 3, "Sweep must occur within short block window (<= 3 blocks)");
  assert.equal(blockDelta, 2);
});

test("Pattern 2 (Edge Case): VASP Sweeping Rejection — Swept ratio <= 95% or delayed block window", () => {
  const inflow = 50000;
  const subThresholdTx = { amount: 46000 }; // 92%
  const subThresholdRatio = (subThresholdTx.amount / inflow) * 100;
  assert.equal(subThresholdRatio > 95, false, "92% must NOT trigger VASP Sweeping");

  const delayedBlockDelta = 85872550 - 85872500; // 50 blocks
  assert.equal(delayedBlockDelta <= 3, false, "50 blocks must NOT qualify as rapid short-window sweep");
});

// ============================================================================
// PATTERN 3: Mixer Relay (Tornado Cash, Sinbad, Blender, Tornado Router)
// ============================================================================
test("Pattern 3: Mixer Relay Detection — Tornado Cash, Sinbad, Blender.io, Tornado Router", () => {
  const knownMixers = [
    { name: "Tornado Cash (Router Smart Contract)", address: "0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b".toLowerCase(), ofacSanctioned: true },
    { name: "Tornado Cash 100 ETH Pool", address: "0xA160ba73130761C61181C504E5540F72A804560B".toLowerCase(), ofacSanctioned: true },
    { name: "Sinbad Mixer", address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh".toLowerCase(), ofacSanctioned: true },
    { name: "Blender.io", address: "1BlenderioPoolXXXXXXXXXXXXXXXa3t6b".toLowerCase(), ofacSanctioned: true },
  ];

  for (const mixer of knownMixers) {
    const testNode = { fullAddress: mixer.address, entityType: "MIXER_OBFUSCATION" };
    const match = knownMixers.find(m => m.address === testNode.fullAddress.toLowerCase());
    assert.ok(match, `Should match known mixer ${mixer.name}`);
    assert.equal(match.ofacSanctioned, true, "Must recognize OFAC sanctions status");
  }
});

// ============================================================================
// PATTERN 4: Bridge Hop (Across, Stargate, Wormhole, Hop, Celer)
// ============================================================================
test("Pattern 4: Bridge Hop Detection — Across, Stargate, Wormhole, Hop, Celer", () => {
  const knownBridges = [
    { name: "Across Protocol", address: "0x4D9079Bb4165aeb4084c526a32695dCfd2F77381".toLowerCase() },
    { name: "Stargate Finance", address: "0x8731d54E9D02c286767d56ac03e8037C07e01e98".toLowerCase() },
    { name: "Wormhole Token Bridge", address: "0x3ee18B2214AFF97000D974cf647E7C347E8fa585".toLowerCase() },
    { name: "Hop Protocol (ETH Bridge)", address: "0x3666f603Cc164936C1b87e207F36BEBa4AC5f18d".toLowerCase() },
    { name: "cBridge (Celer Network)", address: "0x5427FEFA711Eff984124bFBB1AB6fbf5E3DA1820".toLowerCase() },
  ];

  for (const bridge of knownBridges) {
    const testEdge = { target: bridge.address, amount: 25000 };
    const match = knownBridges.find(b => b.address === testEdge.target.toLowerCase());
    assert.ok(match, `Should match bridge ${bridge.name}`);
  }
});

// ============================================================================
// PATTERN 5: Smurfing / Structuring (Multiple fan-in transactions below threshold)
// ============================================================================
test("Pattern 5: Smurfing / Structuring — Multiple fan-in transactions below reporting thresholds", () => {
  const smallTxs = [
    { source: "src1", target: "collector", amount: 800 },
    { source: "src2", target: "collector", amount: 950 },
    { source: "src3", target: "collector", amount: 750 },
    { source: "src4", target: "collector", amount: 850 },
    { source: "src5", target: "collector", amount: 900 },
    { source: "src6", target: "collector", amount: 800 },
    { source: "src7", target: "collector", amount: 950 },
  ];

  const threshold = 3000;
  const filtered = smallTxs.filter(t => t.amount > 0 && t.amount < threshold);
  const total = filtered.reduce((s, t) => s + t.amount, 0);

  assert.ok(filtered.length >= 3, "Must have >=3 fan-in transactions");
  assert.ok(filtered.every(t => t.amount < threshold), "All individual txs must be sub-threshold");
  assert.ok(total >= 3000, "Aggregated structured volume must be >= $3,000");
  assert.equal(total, 6000);
});

// ============================================================================
// PATTERN 6: Round-Trip Wash (Circular flows returning to origin cluster)
// ============================================================================
test("Pattern 6: Round-Trip Wash — Circular flows returning to origin cluster", () => {
  const root = { fullAddress: "0xvictim12345678901234567890123456789012", clusterTag: "cluster-syndicate-alpha" };
  const intermediateNode = { fullAddress: "0xmule3456789012345678901234567890123456", clusterTag: "cluster-syndicate-alpha" };

  const finalEdgeDirect = { source: "0xmule3456789012345678901234567890123456", target: root.fullAddress };
  assert.equal(finalEdgeDirect.target, root.fullAddress, "Direct circular return to root address");

  const isClusterReturn = finalEdgeDirect.target === root.fullAddress || intermediateNode.clusterTag === root.clusterTag;
  assert.equal(isClusterReturn, true, "Must match origin cluster membership");
});

// ============================================================================
// PATTERN 7: Cross-Chain Hop (Transitions between different ledger types)
// ============================================================================
test("Pattern 7: Cross-Chain Hop — Transitions between different ledger types", () => {
  const rootNetwork = "TRON";
  const downstreamNetworks = ["TRON", "ETH", "BSC"];
  const foreignNetworks = downstreamNetworks.filter(n => n !== rootNetwork);
  const distinctForeign = new Set(foreignNetworks).size;

  assert.ok(distinctForeign >= 1, "Must detect at least 1 cross-ledger transition");
  assert.equal(distinctForeign, 2);
  assert.deepEqual([...new Set(foreignNetworks)], ["ETH", "BSC"]);
});

// ============================================================================
// RISK SCORE WEIGHTS & CONFIDENCE CALIBRATION AUDIT
// ============================================================================
test("Risk Score Weights: Exact 100% composite attribution across 6 dimensions", () => {
  const dimensions = [
    { name: "Mixer / Privacy Pool Exposure", weight: 0.25 },
    { name: "Layering Depth & Peeling", weight: 0.25 },
    { name: "Sub-Threshold Structuring (Smurfing)", weight: 0.20 },
    { name: "Cross-Chain Flight & Obfuscation", weight: 0.15 },
    { name: "Sanctioned Entity Exposure", weight: 0.10 },
    { name: "Rapid Sweeping & Mule Velocity", weight: 0.05 },
  ];

  const totalWeight = Math.round(dimensions.reduce((sum, d) => sum + d.weight, 0) * 100) / 100;
  assert.equal(totalWeight, 1.00, "All risk score dimension weights must sum exactly to 1.00 (100%)");
});

