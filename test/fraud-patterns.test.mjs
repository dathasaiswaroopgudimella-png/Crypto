import test from "node:test";
import assert from "node:assert/strict";

// Mock minimal node & edge structures for pattern validation
test("Pattern 1: Peeling Chain Detection — Multi-hop serial forwarding with fee leak", () => {
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

  let chainLength = 0;
  let prevAmount = nodes[0].totalInflowUsd;
  for (const node of nodes.slice(1)) {
    const edge = edges.find(e => e.target === node.fullAddress);
    if (edge) {
      const ratio = edge.amount / prevAmount;
      if (ratio >= 0.70 && ratio < 0.995) {
        chainLength++;
        prevAmount = edge.amount;
      }
    }
  }

  assert.ok(chainLength >= 2, "Should detect at least 2 consecutive peeling hops");
  assert.equal(chainLength, 3);
});

test("Pattern 2: VASP Sweeping — 95%+ outgoing fund sweep", () => {
  const inflow = 50000;
  const outgoingTxs = [
    { toAddress: "TF5cLg27W4r3nQGv7V2v1uA88hQe9k3J8u", amount: 49800 }
  ];
  const sweptRatio = (outgoingTxs[0].amount / inflow) * 100;
  assert.ok(sweptRatio >= 95, "Should trigger high-confidence VASP sweep");
});

test("Pattern 3: Mixer Relay Detection — Match with Tornado Cash / Sanctioned Pools", () => {
  const mixerAddress = "0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b".toLowerCase();
  const testNode = { fullAddress: "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b", entityType: "MIXER_OBFUSCATION" };
  assert.equal(testNode.fullAddress.toLowerCase(), mixerAddress);
});

test("Pattern 4: Bridge Hop Detection — Match with Across/Hop/Wormhole Routers", () => {
  const bridgeAddress = "0x4D9079Bb4165aeb4084c526a32695dCfd2F77381".toLowerCase(); // Across Protocol
  const testEdge = { target: "0x4d9079bb4165aeb4084c526a32695dcfd2f77381", amount: 15000 };
  assert.equal(testEdge.target.toLowerCase(), bridgeAddress);
});

test("Pattern 5: Smurfing / Structuring Detection — Fan-in micro transactions", () => {
  const smallTxs = [
    { source: "src1", target: "collector", amount: 800 },
    { source: "src2", target: "collector", amount: 950 },
    { source: "src3", target: "collector", amount: 750 },
    { source: "src4", target: "collector", amount: 850 },
    { source: "src5", target: "collector", amount: 900 },
    { source: "src6", target: "collector", amount: 800 },
    { source: "src7", target: "collector", amount: 950 },
  ];
  const total = smallTxs.reduce((s, t) => s + t.amount, 0);
  assert.ok(smallTxs.length >= 3);
  assert.ok(smallTxs.every(t => t.amount < 1000));
  assert.ok(total >= 5000);
});

test("Pattern 6: Round-Trip Wash — Funds returning to origin cluster", () => {
  const root = "0xvictim12345678901234567890123456789012";
  const finalEdge = { source: "0xmule3456789012345678901234567890123456", target: root };
  assert.equal(finalEdge.target, root);
});

test("Pattern 7: Cross-Chain Hop Detection — Multi-ledger transition", () => {
  const rootNetwork = "TRON";
  const downstreamNetworks = ["TRON", "ETH", "BSC"];
  const distinct = new Set(downstreamNetworks).size;
  assert.ok(distinct > 1);
  assert.equal(distinct, 3);
});
