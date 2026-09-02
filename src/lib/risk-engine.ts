import { FraudPattern, ForensicNode, RiskScore, RiskDimension, RiskLevel, CrossChainHop } from "./types";
import { KNOWN_HIGH_RISK_ENTITIES } from "./constants";

/**
 * Deterministic 6-dimension risk scoring engine.
 * Every score is calculated from real graph topology and live on-chain forensic data.
 */
export class RiskScoringEngine {

  static score(
    nodes: ForensicNode[],
    patterns: FraudPattern[],
    actualMaxHop: number,
    distinctChains: number,
    crossChainHops: CrossChainHop[] = []
  ): RiskScore {
    const dimensions: RiskDimension[] = [
      this.scoreMixerProximity(nodes, patterns),
      this.scoreVaspAttributionConfidence(nodes, patterns),
      this.scoreLayeringDepth(actualMaxHop, patterns),
      this.scoreCrossChainComplexity(distinctChains, crossChainHops, patterns),
      this.scoreStructuringSignals(patterns, nodes),
      this.scoreSanctionedEntityExposure(nodes),
    ];

    const total = Math.min(
      100,
      Math.max(0, Math.round(dimensions.reduce((sum, d) => sum + d.score * d.weight, 0)))
    );

    return {
      total,
      level: this.toLevel(total),
      dimensions,
      generatedAtUtc: new Date().toISOString(),
    };
  }

  private static toLevel(score: number): RiskLevel {
    if (score >= 80) return "CRITICAL";
    if (score >= 60) return "HIGH";
    if (score >= 35) return "MEDIUM";
    return "LOW";
  }

  /**
   * Dimension 1 — Mixer Proximity (weight 25%)
   * Proximity to privacy protocols, tumblers, and mixer pools.
   */
  private static scoreMixerProximity(nodes: ForensicNode[], patterns: FraudPattern[]): RiskDimension {
    const mixerPattern = patterns.find(p => p.patternType === "MIXER_RELAY");
    const mixerAddresses = new Set(KNOWN_HIGH_RISK_ENTITIES.map(e => e.address.toLowerCase()));

    let score = 0;
    let explanation = "No known mixer or tumbler detected in the transaction path.";

    if (mixerPattern) {
      score = 100;
      explanation = `Direct interaction with sanctioned mixer/tumbler on hop ${mixerPattern.detectedAtHop}. Extreme obfuscation risk.`;
    } else {
      let minMixerHop = 999;
      for (const node of nodes) {
        if (mixerAddresses.has(node.fullAddress.toLowerCase())) {
          if (node.hopDistance < minMixerHop) minMixerHop = node.hopDistance;
        }
      }

      if (minMixerHop === 0) {
        score = 100;
        explanation = "Root wallet is an identified privacy pool / mixer address.";
      } else if (minMixerHop === 1) {
        score = 75;
        explanation = "Wallet transacted directly (1 hop) with a known mixer / tumbler address.";
      } else if (minMixerHop === 2) {
        score = 45;
        explanation = "Funds are 2 hops removed from a known mixer / privacy pool.";
      } else if (minMixerHop <= 4) {
        score = 20;
        explanation = `Indirect mixer proximity (${minMixerHop} hops removed). Secondary contamination risk.`;
      } else {
        score = 0;
        explanation = "Standard transparent ledger routing; zero mixer contamination identified.";
      }
    }

    return { name: "Mixer Proximity", score, weight: 0.25, explanation };
  }

  /**
   * Dimension 2 — VASP Attribution Confidence (weight 25%)
   * Higher score when VASP is identified via hot-wallet match or sweeping heuristic.
   */
  private static scoreVaspAttributionConfidence(nodes: ForensicNode[], patterns: FraudPattern[]): RiskDimension {
    const vaspNodes = nodes.filter(n =>
      n.entityType === "VASP_HOT_WALLET" ||
      n.entityType === "VASP_COLD_VAULT" ||
      n.entityType === "VASP_DEPOSIT_ADDRESS"
    );

    const sweepPattern = patterns.find(p => p.patternType === "VASP_SWEEPING");

    let score = 15;
    let explanation = "Non-custodial unhosted wallet; funds have not reached a centralized exchange.";

    if (vaspNodes.length > 0) {
      const directMatch = vaspNodes.find(n => n.entityName);
      if (directMatch) {
        score = 98;
        explanation = `Verified VASP identified: ${directMatch.entityName} (${directMatch.entityType.replace(/_/g, " ")}). FIU-IND production notice can be issued.`;
      } else if (sweepPattern) {
        score = 88;
        explanation = `2-step automated VASP sweeping confirmed with ${sweepPattern.confidence}% confidence. Intermediate exchange deposit node identified.`;
      } else {
        score = 65;
        explanation = "VASP deposit cluster detected based on transaction fan-out. Manual cross-check recommended.";
      }
    } else if (sweepPattern) {
      score = 82;
      explanation = "High-volume sweeping pattern detected into centralized liquidity aggregator.";
    }

    return { name: "VASP Attribution Confidence", score, weight: 0.25, explanation };
  }

  /**
   * Dimension 3 — Layering Depth & Hop Complexity (weight 20%)
   * Based on the ACTUAL maximum hop distance in the graph.
   */
  private static scoreLayeringDepth(actualMaxHop: number, patterns: FraudPattern[]): RiskDimension {
    const peeling = patterns.find(p => p.patternType === "PEELING_CHAIN");

    let score = 0;
    let explanation = "";

    if (actualMaxHop <= 0) {
      score = 10;
      explanation = "Single wallet analysis; no downstream layering hops detected.";
    } else if (actualMaxHop === 1) {
      score = 25;
      explanation = "Direct 1-hop transfer. Minimal intermediary layering.";
    } else if (actualMaxHop === 2) {
      score = 50;
      explanation = "2-hop intermediary routing detected. Simple mule wallet used.";
    } else if (actualMaxHop === 3) {
      score = 70;
      explanation = "3-hop mule wallet layering chain. Organized layering structure.";
    } else if (actualMaxHop === 4) {
      score = 85;
      explanation = "4-hop deep layering. Sophisticated obfuscation chain.";
    } else {
      score = 95;
      explanation = `${actualMaxHop}+ hops traversed. Extreme layering depth across multiple mule wallets.`;
    }

    if (peeling) {
      score = Math.min(100, score + 10);
      explanation += ` Confirmed serial peeling chain pattern (${peeling.confidence}% conf).`;
    }

    return { name: "Layering Depth", score, weight: 0.20, explanation };
  }

  /**
   * Dimension 4 — Cross-Chain Complexity (weight 15%)
   * Inter-ledger bridge flight across multiple blockchains.
   */
  private static scoreCrossChainComplexity(
    distinctChains: number,
    crossChainHops: CrossChainHop[],
    patterns: FraudPattern[]
  ): RiskDimension {
    const bridgePattern = patterns.find(p => p.patternType === "BRIDGE_HOP");
    const crossChainPattern = patterns.find(p => p.patternType === "CROSS_CHAIN_HOP");

    let score = 0;
    let explanation = "";

    if (distinctChains >= 3 || crossChainHops.length >= 2) {
      score = 95;
      explanation = `Complex multi-bridge traversal spanning ${distinctChains} distinct blockchains (e.g. TRON, ETH, BSC). High cross-ledger obfuscation.`;
    } else if (distinctChains === 2 || crossChainHops.length === 1 || bridgePattern || crossChainPattern) {
      score = 70;
      explanation = `Cross-chain bridge flight detected (${crossChainHops[0]?.bridgeName || "Bridge Router"}). Funds moved across ledgers to complicate single-chain tracking.`;
    } else {
      score = 5;
      explanation = "Single-chain transaction. Standard on-chain tracing applies.";
    }

    return { name: "Cross-Chain Complexity", score, weight: 0.15, explanation };
  }

  /**
   * Dimension 5 — Structuring / Smurfing Signals (weight 10%)
   * Micro-transaction structuring and rapid fund dissipation.
   */
  private static scoreStructuringSignals(patterns: FraudPattern[], nodes: ForensicNode[]): RiskDimension {
    const smurfing = patterns.find(p => p.patternType === "SMURFING");
    const sweeping = patterns.find(p => p.patternType === "VASP_SWEEPING");

    let score = 10;
    let explanation = "Standard transaction sizing; no sub-threshold structuring detected.";

    if (smurfing) {
      score = smurfing.confidence;
      explanation = `Smurfing / Structuring detected: ${smurfing.evidenceDescription}`;
    } else if (sweeping) {
      score = 65;
      explanation = "Rapid fund dissipation: high percentage of incoming volume forwarded in quick succession.";
    } else {
      // Check node transaction velocity
      const totalOutflowCount = nodes.reduce((c, n) => c + (n.totalOutflowUsd > 0 ? 1 : 0), 0);
      if (totalOutflowCount >= 4) {
        score = 35;
        explanation = "Moderate transaction fan-out across multiple recipient accounts.";
      }
    }

    return { name: "Structuring / Smurfing Signals", score, weight: 0.10, explanation };
  }

  /**
   * Dimension 6 — Sanctioned Entity Exposure (weight 5%)
   * Direct or indirect contact with OFAC / MHA / FIU blacklisted addresses.
   */
  private static scoreSanctionedEntityExposure(nodes: ForensicNode[]): RiskDimension {
    const sanctionedAddrs = new Set(
      KNOWN_HIGH_RISK_ENTITIES
        .filter(e => e.ofacSanctioned)
        .map(e => e.address.toLowerCase())
    );

    let minSanctionedHop = 999;
    let hitNode: ForensicNode | undefined;

    for (const node of nodes) {
      if (sanctionedAddrs.has(node.fullAddress.toLowerCase())) {
        if (node.hopDistance < minSanctionedHop) {
          minSanctionedHop = node.hopDistance;
          hitNode = node;
        }
      }
    }

    let score = 0;
    let explanation = "Zero OFAC-sanctioned or MHA-designated entity exposure found.";

    if (minSanctionedHop === 0) {
      score = 100;
      explanation = `Subject wallet is directly on the OFAC SDN List / MHA Designated List (${hitNode?.fullAddress.slice(0, 10)}...). Immediate escalation required.`;
    } else if (minSanctionedHop === 1) {
      score = 70;
      explanation = `Direct counterparty (1 hop) to OFAC-sanctioned entity (${hitNode?.fullAddress.slice(0, 10)}...). Direct taint exposure.`;
    } else if (minSanctionedHop <= 3) {
      score = 35;
      explanation = `Secondary exposure (${minSanctionedHop} hops) to sanctioned entity cluster.`;
    }

    return { name: "Sanctioned Entity Exposure", score, weight: 0.05, explanation };
  }
}
