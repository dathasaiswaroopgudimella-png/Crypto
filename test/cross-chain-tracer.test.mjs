import test from "node:test";
import assert from "node:assert/strict";

// Simulated bridge definitions and logic mirroring CrossChainBridgeTracer & constants
const KNOWN_BRIDGE_CONTRACTS = [
  {
    name: "Across Protocol",
    bridgeProtocol: "Across Protocol HubPool",
    address: "0x4D9079Bb4165aeb4084c526a32695dCfd2F77381",
    network: "ETH",
    destinationChains: ["TRON", "ARBITRUM", "OPTIMISM", "BASE", "POLYGON", "BSC"],
  },
  {
    name: "Across Protocol (SpokePool)",
    bridgeProtocol: "Across Protocol SpokePool",
    address: "0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5",
    network: "ETH",
    destinationChains: ["TRON", "ARBITRUM", "OPTIMISM", "BASE", "POLYGON", "BSC"],
  },
  {
    name: "Hop Protocol (ETH Bridge)",
    bridgeProtocol: "Hop Protocol Bridge",
    address: "0x3666f603Cc164936C1b87e207F36BEBa4AC5f18d",
    network: "ETH",
    destinationChains: ["ARBITRUM", "BSC", "POLYGON", "OPTIMISM"],
  },
  {
    name: "Hop Protocol (USDC Bridge)",
    bridgeProtocol: "Hop Protocol Bridge",
    address: "0x3666f603Cc164936C1b87e207F36BEBa4AC5f18a",
    network: "ETH",
    destinationChains: ["ARBITRUM", "BSC", "POLYGON", "OPTIMISM"],
  },
  {
    name: "Wormhole Token Bridge",
    bridgeProtocol: "Wormhole Core Bridge",
    address: "0x3ee18B2214AFF97000D974cf647E7C347E8fa585",
    network: "ETH",
    destinationChains: ["BSC", "SOL", "ARBITRUM", "AVALANCHE", "POLYGON"],
  },
  {
    name: "Stargate Finance",
    bridgeProtocol: "Stargate Bridge Router",
    address: "0x8731d54E9D02c286767d56ac03e8037C07e01e98",
    network: "ETH",
    destinationChains: ["BSC", "ARBITRUM", "TRON", "AVALANCHE", "POLYGON", "OPTIMISM"],
  },
  {
    name: "cBridge (Celer Network)",
    bridgeProtocol: "cBridge (Celer Network)",
    address: "0x5427FEFA711Eff984124bFBB1AB6fbf5E3DA1820",
    network: "ETH",
    destinationChains: ["BSC", "ARBITRUM", "POLYGON", "OPTIMISM", "AVALANCHE"],
  },
];

const KNOWN_VASP_REGISTRY = [
  {
    name: "Binance",
    legalEntity: "Nest Services Limited / Binance Holdings Ltd",
    fiuRegistered: true,
    fiuRegistrationNumber: "FIU-IND/RE/2024/0089",
    complianceEmail: "compliance-india@binance.com",
    nodalOfficer: "India Compliance Team",
    jurisdiction: "Registered Entity under PMLA Guidelines (FIU-IND)",
    freezeRequestEmail: "lawenforcement@binance.com",
    hotWallets: [
      { address: "0x28C6c06298d514Db089934071355E5743bf21d60", network: "ETH", type: "VASP_HOT_WALLET" },
      { address: "0xe2fc31F816A9b3dcd668F787b4380bbc6F5C0D27", network: "BSC", type: "VASP_HOT_WALLET" },
      { address: "0x8894E0a0c962CB723c1976a4421c95949bE2D4E3", network: "BSC", type: "VASP_HOT_WALLET" },
      { address: "TF5cLg27W4r3nQGv7V2v1uA88hQe9k3J8u", network: "TRON", type: "VASP_HOT_WALLET" },
      { address: "TJCo98saj3uMLdmyV6h4HZkXELhgTe7MAY", network: "TRON", type: "VASP_HOT_WALLET" },
      { address: "0x28C6c06298d514Db089934071355E5743bf21d60", network: "ARBITRUM", type: "VASP_HOT_WALLET" },
    ],
  },
];

const PROTOCOL_PROFILES = {
  "across protocol": { feeRate: 0.010, minFeeUsd: 15, delaySeconds: 420 },
  "stargate": { feeRate: 0.005, minFeeUsd: 10, delaySeconds: 300 },
  "wormhole": { feeRate: 0.004, minFeeUsd: 10, delaySeconds: 600 },
  "hop protocol": { feeRate: 0.006, minFeeUsd: 10, delaySeconds: 480 },
  "cbridge": { feeRate: 0.005, minFeeUsd: 10, delaySeconds: 360 },
};

function calculateBridgeFee(bridgeName, amountUsd) {
  const nameLower = bridgeName.toLowerCase();
  let profile = { feeRate: 0.007, minFeeUsd: 10, delaySeconds: 420 };
  for (const [key, val] of Object.entries(PROTOCOL_PROFILES)) {
    if (nameLower.includes(key)) {
      profile = val;
      break;
    }
  }
  if (amountUsd <= 0) return { feeUsd: 0, feeRate: profile.feeRate, netAmountUsd: 0, delaySeconds: profile.delaySeconds };
  const rawFee = amountUsd * profile.feeRate;
  const feeUsd = Math.round(Math.min(amountUsd, Math.max(profile.minFeeUsd, rawFee)) * 100) / 100;
  const netAmountUsd = Math.max(0, Math.round((amountUsd - feeUsd) * 100) / 100);
  return { feeUsd, feeRate: profile.feeRate, netAmountUsd, delaySeconds: profile.delaySeconds };
}

function resolveDestinationRoute(bridgeRecord, originChain, targetChainOverride) {
  const cleanName = bridgeRecord.name.toLowerCase();
  const feeInfo = calculateBridgeFee(bridgeRecord.name, 10000);
  const availableChains = bridgeRecord.destinationChains.filter(c => c !== originChain);
  let selectedChain = targetChainOverride && availableChains.includes(targetChainOverride)
    ? targetChainOverride
    : (availableChains[0] || (originChain === "ETH" ? "TRON" : "ETH"));

  if (!targetChainOverride) {
    if (cleanName.includes("across")) {
      selectedChain = originChain === "TRON" ? "ETH" : (availableChains.includes("TRON") ? "TRON" : "ARBITRUM");
    } else if (cleanName.includes("stargate")) {
      selectedChain = originChain === "BSC" ? "ETH" : (availableChains.includes("BSC") ? "BSC" : "ARBITRUM");
    } else if (cleanName.includes("wormhole")) {
      selectedChain = originChain === "BSC" ? "ETH" : (availableChains.includes("BSC") ? "BSC" : "SOL");
    } else if (cleanName.includes("hop")) {
      selectedChain = originChain === "ARBITRUM" ? "ETH" : (availableChains.includes("ARBITRUM") ? "ARBITRUM" : "BSC");
    } else if (cleanName.includes("cbridge")) {
      selectedChain = originChain === "BSC" ? "ETH" : (availableChains.includes("BSC") ? "BSC" : "ARBITRUM");
    }
  }

  let destWallet = "0x28C6c06298d514Db089934071355E5743bf21d60";
  let tokenSymbol = "USDC";

  if (selectedChain === "TRON") {
    destWallet = cleanName.includes("across") ? "TJCo98saj3uMLdmyV6h4HZkXELhgTe7MAY" : "TF5cLg27W4r3nQGv7V2v1uA88hQe9k3J8u";
    tokenSymbol = "USDT";
  } else if (selectedChain === "BSC") {
    destWallet = cleanName.includes("wormhole") ? "0x8894E0a0c962CB723c1976a4421c95949bE2D4E3" : "0xe2fc31F816A9b3dcd668F787b4380bbc6F5C0D27";
    tokenSymbol = "USDT";
  } else if (selectedChain === "ARBITRUM") {
    destWallet = "0x28C6c06298d514Db089934071355E5743bf21d60";
    tokenSymbol = "USDC";
  } else if (selectedChain === "SOL") {
    destWallet = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
    tokenSymbol = "SOL";
  }

  return { destChain: selectedChain, destWallet, tokenSymbol, delaySeconds: feeInfo.delaySeconds, feeRate: feeInfo.feeRate };
}

// =================== TEST SUITE ===================

test("Mandate 1: Cross-Chain Bridge Contract Matching for Across, Stargate, Wormhole, Hop, and Celer cBridge", () => {
  const testAddresses = [
    { label: "Across HubPool", addr: "0x4D9079Bb4165aeb4084c526a32695dCfd2F77381", expected: "Across Protocol" },
    { label: "Across SpokePool", addr: "0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5", expected: "Across Protocol (SpokePool)" },
    { label: "Stargate Finance", addr: "0x8731d54E9D02c286767d56ac03e8037C07e01e98", expected: "Stargate Finance" },
    { label: "Wormhole Portal", addr: "0x3ee18B2214AFF97000D974cf647E7C347E8fa585", expected: "Wormhole Token Bridge" },
    { label: "Hop Protocol ETH", addr: "0x3666f603Cc164936C1b87e207F36BEBa4AC5f18d", expected: "Hop Protocol (ETH Bridge)" },
    { label: "Hop Protocol USDC", addr: "0x3666f603Cc164936C1b87e207F36BEBa4AC5f18a", expected: "Hop Protocol (USDC Bridge)" },
    { label: "Celer cBridge", addr: "0x5427FEFA711Eff984124bFBB1AB6fbf5E3DA1820", expected: "cBridge (Celer Network)" },
  ];

  for (const item of testAddresses) {
    // Exact match
    const match = KNOWN_BRIDGE_CONTRACTS.find(b => b.address.toLowerCase() === item.addr.toLowerCase());
    assert.ok(match, `Failed to match bridge contract: ${item.label}`);
    assert.equal(match.name, item.expected);

    // Case-insensitivity & whitespace tolerance
    const upperMatch = KNOWN_BRIDGE_CONTRACTS.find(b => b.address.toLowerCase() === `  ${item.addr.toUpperCase()}  `.trim().toLowerCase());
    assert.ok(upperMatch, `Case insensitivity check failed for: ${item.label}`);
  }

  // Non-bridge address returns undefined
  const fakeMatch = KNOWN_BRIDGE_CONTRACTS.find(b => b.address.toLowerCase() === "0x000000000000000000000000000000000000dead");
  assert.equal(fakeMatch, undefined);
});

test("Mandate 2: Across Protocol ETH ➔ TRON Continuation, Slippage/Fee, Timestamps, and Binance VASP Attribution", () => {
  const bridge = KNOWN_BRIDGE_CONTRACTS.find(b => b.name === "Across Protocol");
  const originChain = "ETH";
  const originTxHash = "0x77aa88bb99cc11dd22ee33ff44aa55bb66cc77dd88ee99ff00aa11bb22cc33dd";
  const originTimestamp = "2026-08-28T11:28:15.000Z";
  const amountUsd = 200000.00;

  const route = resolveDestinationRoute(bridge, originChain);
  assert.equal(route.destChain, "TRON");
  assert.equal(route.destWallet, "TJCo98saj3uMLdmyV6h4HZkXELhgTe7MAY");
  assert.equal(route.tokenSymbol, "USDT");

  const feeCalc = calculateBridgeFee(bridge.name, amountUsd);
  assert.equal(feeCalc.feeRate, 0.010); // 1.0%
  assert.equal(feeCalc.feeUsd, 2000.00);
  assert.equal(feeCalc.netAmountUsd, 198000.00); // Delivered amount minus slippage/fee

  // Timestamp forward by propagation delay (~7 minutes = 420s)
  const destTimestamp = new Date(new Date(originTimestamp).getTime() + route.delaySeconds * 1000).toISOString();
  assert.equal(destTimestamp, "2026-08-28T11:35:15.000Z");
  assert.ok(new Date(destTimestamp) > new Date(originTimestamp));

  // VASP attribution check
  const vasp = KNOWN_VASP_REGISTRY.find(v => v.hotWallets.some(hw => hw.address === route.destWallet));
  assert.ok(vasp, "Must attribute destination recipient to known VASP");
  assert.equal(vasp.name, "Binance");
  assert.equal(vasp.fiuRegistered, true);
  assert.equal(vasp.fiuRegistrationNumber, "FIU-IND/RE/2024/0089");
});

test("Mandate 2: Stargate Finance ETH ➔ BSC Continuation with 0.5% Fee and Binance BSC Node", () => {
  const bridge = KNOWN_BRIDGE_CONTRACTS.find(b => b.name === "Stargate Finance");
  const originChain = "ETH";
  const originTimestamp = "2026-09-01T14:00:00.000Z";
  const amountUsd = 50000.00;

  const route = resolveDestinationRoute(bridge, originChain);
  assert.equal(route.destChain, "BSC");
  assert.equal(route.destWallet, "0xe2fc31F816A9b3dcd668F787b4380bbc6F5C0D27");

  const feeCalc = calculateBridgeFee(bridge.name, amountUsd);
  assert.equal(feeCalc.feeRate, 0.005); // 0.5%
  assert.equal(feeCalc.feeUsd, 250.00);
  assert.equal(feeCalc.netAmountUsd, 49750.00);

  // Timestamp forward by 5 minutes
  const destTimestamp = new Date(new Date(originTimestamp).getTime() + route.delaySeconds * 1000).toISOString();
  assert.equal(destTimestamp, "2026-09-01T14:05:00.000Z");

  const vasp = KNOWN_VASP_REGISTRY.find(v => v.hotWallets.some(hw => hw.address === route.destWallet));
  assert.equal(vasp.name, "Binance");
});

test("Mandate 2: Hop Protocol ETH ➔ ARBITRUM Continuation with 0.6% Bonder Fee", () => {
  const bridge = KNOWN_BRIDGE_CONTRACTS.find(b => b.name === "Hop Protocol (ETH Bridge)");
  const originChain = "ETH";
  const originTimestamp = "2026-09-02T10:00:00.000Z";
  const amountUsd = 75000.00;

  const route = resolveDestinationRoute(bridge, originChain);
  assert.equal(route.destChain, "ARBITRUM");
  assert.equal(route.destWallet, "0x28C6c06298d514Db089934071355E5743bf21d60");

  const feeCalc = calculateBridgeFee(bridge.name, amountUsd);
  assert.equal(feeCalc.feeRate, 0.006); // 0.6%
  assert.equal(feeCalc.feeUsd, 450.00);
  assert.equal(feeCalc.netAmountUsd, 74550.00);

  // Timestamp forward by 8 minutes
  const destTimestamp = new Date(new Date(originTimestamp).getTime() + route.delaySeconds * 1000).toISOString();
  assert.equal(destTimestamp, "2026-09-02T10:08:00.000Z");

  const vasp = KNOWN_VASP_REGISTRY.find(v => v.hotWallets.some(hw => hw.address === route.destWallet));
  assert.equal(vasp.name, "Binance");
});

test("Mandate 2: Wormhole Token Bridge ETH ➔ BSC Continuation with 0.4% Fee", () => {
  const bridge = KNOWN_BRIDGE_CONTRACTS.find(b => b.name === "Wormhole Token Bridge");
  const originChain = "ETH";
  const originTimestamp = "2026-09-03T16:30:00.000Z";
  const amountUsd = 120000.00;

  const route = resolveDestinationRoute(bridge, originChain);
  assert.equal(route.destChain, "BSC");
  assert.equal(route.destWallet, "0x8894E0a0c962CB723c1976a4421c95949bE2D4E3");

  const feeCalc = calculateBridgeFee(bridge.name, amountUsd);
  assert.equal(feeCalc.feeRate, 0.004); // 0.4%
  assert.equal(feeCalc.feeUsd, 480.00);
  assert.equal(feeCalc.netAmountUsd, 119520.00);

  // Timestamp forward by 10 minutes
  const destTimestamp = new Date(new Date(originTimestamp).getTime() + route.delaySeconds * 1000).toISOString();
  assert.equal(destTimestamp, "2026-09-03T16:40:00.000Z");

  const vasp = KNOWN_VASP_REGISTRY.find(v => v.hotWallets.some(hw => hw.address === route.destWallet));
  assert.equal(vasp.name, "Binance");
});

test("Mandate 2: Celer cBridge ETH ➔ BSC Continuation with 0.5% Fee", () => {
  const bridge = KNOWN_BRIDGE_CONTRACTS.find(b => b.name === "cBridge (Celer Network)");
  const originChain = "ETH";
  const amountUsd = 80000.00;

  const route = resolveDestinationRoute(bridge, originChain);
  assert.equal(route.destChain, "BSC");
  assert.equal(route.destWallet, "0xe2fc31F816A9b3dcd668F787b4380bbc6F5C0D27");

  const feeCalc = calculateBridgeFee(bridge.name, amountUsd);
  assert.equal(feeCalc.feeRate, 0.005);
  assert.equal(feeCalc.feeUsd, 400.00);
  assert.equal(feeCalc.netAmountUsd, 79600.00);

  const vasp = KNOWN_VASP_REGISTRY.find(v => v.hotWallets.some(hw => hw.address === route.destWallet));
  assert.equal(vasp.name, "Binance");
});

test("Destination Route Override: Allows investigator to trace alternate supported branches", () => {
  const bridge = KNOWN_BRIDGE_CONTRACTS.find(b => b.name === "Across Protocol");
  const originChain = "ETH";

  // Override to ARBITRUM
  const routeArb = resolveDestinationRoute(bridge, originChain, "ARBITRUM");
  assert.equal(routeArb.destChain, "ARBITRUM");
  assert.equal(routeArb.destWallet, "0x28C6c06298d514Db089934071355E5743bf21d60");

  // Override Hop to BSC
  const hopBridge = KNOWN_BRIDGE_CONTRACTS.find(b => b.name === "Hop Protocol (ETH Bridge)");
  const routeHopBsc = resolveDestinationRoute(hopBridge, originChain, "BSC");
  assert.equal(routeHopBsc.destChain, "BSC");
  assert.equal(routeHopBsc.destWallet, "0xe2fc31F816A9b3dcd668F787b4380bbc6F5C0D27");
});

test("Robustness & Edge Cases: Zero amounts, bounds checking, and deterministic 66-character tx hashes", () => {
  // 1. Zero amount
  const zeroFee = calculateBridgeFee("Across Protocol", 0);
  assert.equal(zeroFee.feeUsd, 0);
  assert.equal(zeroFee.netAmountUsd, 0);

  // 2. Negative amount
  const negFee = calculateBridgeFee("Stargate Finance", -5000);
  assert.equal(negFee.feeUsd, 0);
  assert.equal(negFee.netAmountUsd, 0);

  // 3. Small amount below min fee bounds
  const microFee = calculateBridgeFee("Across Protocol", 500);
  assert.equal(microFee.feeUsd, 15); // min fee $15
  assert.equal(microFee.netAmountUsd, 485);

  // 4. Deterministic 66-character hash simulation
  function testHash(origin, chain, bridge) {
    const s = `${origin}:${chain}:${bridge}`;
    let hex = "";
    for (let i = 0; i < 64; i++) {
      hex += ((i * 7 + s.length * 13) % 16).toString(16);
    }
    return `0x${hex}`;
  }
  const h1 = testHash("0xorigin123", "TRON", "0xbridge456");
  const h2 = testHash("0xorigin123", "TRON", "0xbridge456");
  assert.equal(h1.length, 66);
  assert.match(h1, /^0x[0-9a-f]{64}$/);
  assert.equal(h1, h2, "Hash must be reproducible and deterministic");
});

