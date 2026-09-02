import { FraudPattern, ForensicNode, RiskScore, RiskDimension, RiskLevel, CrossChainHop, VaspAttributionResult } from "./types";
import { KNOWN_HIGH_RISK_ENTITIES, KNOWN_VASP_REGISTRY } from "./constants";

/**
 * Deterministic Criminal / Laundering Risk Scoring Engine.
 * Measures STRICTLY criminality, obfuscation, and money laundering indicators.
 * Note: VASP Attribution Confidence is an independent metric and is not conflated with criminal risk.
 */
export class RiskScoringEngine {

  static scoreCriminalRisk(
    nodes: ForensicNode[],
    patterns: FraudPattern[],
    actualMaxHop: number,
    distinctChains: number,
    crossChainHops: CrossChainHop[] = []
  ): RiskScore {
    const dimensions: RiskDimension[] = [
      this.scoreMixerProximity(nodes, patterns),
      this.scoreLayeringDepth(actualMaxHop, patterns),
      this.scoreStructuringSignals(patterns, nodes),
      this.scoreCrossChainFlight(distinctChains, crossChainHops, patterns),
      this.scoreSanctionedEntityExposure(nodes),
      this.scoreAutomatedSweepingVelocity(patterns, nodes),
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

  // Backward compatibility wrapper
  static score(
    nodes: ForensicNode[],
    patterns: FraudPattern[],
    actualMaxHop: number,
    distinctChains: number,
    crossChainHops: CrossChainHop[] = []
  ): RiskScore {
    return this.scoreCriminalRisk(nodes, patterns, actualMaxHop, distinctChains, crossChainHops);
  }

  private static toLevel(score: number): RiskLevel {
    if (score >= 80) return "CRITICAL";
    if (score >= 60) return "HIGH";
    if (score >= 35) return "MEDIUM";
    return "LOW";
  }

  /**
   * Dimension 1 — Mixer & Tumbler Exposure (weight 25%)
   */
  private static scoreMixerProximity(nodes: ForensicNode[], patterns: FraudPattern[]): RiskDimension {
    const mixerPattern = patterns.find(p => p.patternType === "MIXER_RELAY");
    const mixerAddresses = new Set(KNOWN_HIGH_RISK_ENTITIES.map(e => e.address.toLowerCase()));

    let score = 0;
    let explanation = "No known mixer or tumbler detected in the transaction path.";

    if (mixerPattern) {
      score = 100;
      explanation = `Direct interaction with sanctioned mixer/tumbler on hop ${mixerPattern.detectedAtHop}. Severe obfuscation flag under PMLA §3.`;
    } else {
      let minMixerHop = 999;
      for (const node of nodes) {
        if (mixerAddresses.has(node.fullAddress.toLowerCase())) {
          if (node.hopDistance < minMixerHop) minMixerHop = node.hopDistance;
        }
      }

      if (minMixerHop === 0) {
        score = 100;
        explanation = "Subject wallet is an identified privacy pool / tumbler node.";
      } else if (minMixerHop === 1) {
        score = 75;
        explanation = "Direct counterparty (1 hop) to known mixer / tumbler address. High contamination risk.";
      } else if (minMixerHop === 2) {
        score = 45;
        explanation = "Funds passed 2 hops from a known mixer / privacy pool.";
      } else if (minMixerHop <= 4) {
        score = 20;
        explanation = `Indirect mixer proximity (${minMixerHop} hops removed). Secondary contamination.`;
      } else {
        score = 0;
        explanation = "Standard transparent ledger routing; zero mixer contamination identified.";
      }
    }

    return { name: "Mixer / Privacy Pool Exposure", score, weight: 0.25, explanation };
  }

  /**
   * Dimension 2 — Layering Depth & Peeling Chains (weight 25%)
   */
  private static scoreLayeringDepth(actualMaxHop: number, patterns: FraudPattern[]): RiskDimension {
    const peeling = patterns.find(p => p.patternType === "PEELING_CHAIN");

    let score = 0;
    let explanation = "";

    if (actualMaxHop <= 0) {
      score = 10;
      explanation = "Single wallet assessment; no downstream layering hops observed.";
    } else if (actualMaxHop === 1) {
      score = 25;
      explanation = "Direct 1-hop movement; minimal intermediary layering.";
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
      explanation = `${actualMaxHop}+ hops traversed. Extreme layering depth across multiple intermediary mules.`;
    }

    if (peeling) {
      score = Math.min(100, score + 10);
      explanation += ` Confirmed serial peeling chain pattern (${peeling.confidence}% conf).`;
    }

    return { name: "Layering Depth & Peeling", score, weight: 0.25, explanation };
  }

  /**
   * Dimension 3 — Structuring & Smurfing Signals (weight 20%)
   */
  private static scoreStructuringSignals(patterns: FraudPattern[], nodes: ForensicNode[]): RiskDimension {
    const smurfing = patterns.find(p => p.patternType === "SMURFING");

    let score = 10;
    let explanation = "Standard transaction sizing; no sub-threshold structuring detected.";

    if (smurfing) {
      score = smurfing.confidence;
      explanation = `Smurfing / Structuring detected: ${smurfing.evidenceDescription}`;
    } else {
      const activeTransactors = nodes.filter(n => n.totalOutflowUsd > 0).length;
      if (activeTransactors >= 4) {
        score = 45;
        explanation = `Transaction fragmentation observed across ${activeTransactors} recipient accounts.`;
      }
    }

    return { name: "Sub-Threshold Structuring (Smurfing)", score, weight: 0.20, explanation };
  }

  /**
   * Dimension 4 — Cross-Chain Flight & Bridge Obfuscation (weight 15%)
   */
  private static scoreCrossChainFlight(
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
      explanation = `Complex multi-bridge flight across ${distinctChains} distinct blockchains. High cross-ledger evasion risk.`;
    } else if (distinctChains === 2 || crossChainHops.length === 1 || bridgePattern || crossChainPattern) {
      score = 75;
      explanation = `Cross-chain bridge hop identified (${crossChainHops[0]?.bridgeName || "Bridge Protocol"}). Inter-chain movement to evade single-ledger tracking.`;
    } else {
      score = 5;
      explanation = "Single-ledger transaction trail. Standard on-chain tracing applies.";
    }

    return { name: "Cross-Chain Flight & Obfuscation", score, weight: 0.15, explanation };
  }

  /**
   * Dimension 5 — Sanctioned Entity & High-Risk Exposure (weight 10%)
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
      score = 75;
      explanation = `Direct counterparty (1 hop) to OFAC-sanctioned entity (${hitNode?.fullAddress.slice(0, 10)}...). Direct taint exposure.`;
    } else if (minSanctionedHop <= 3) {
      score = 40;
      explanation = `Secondary exposure (${minSanctionedHop} hops) to sanctioned entity cluster.`;
    }

    return { name: "Sanctioned Entity Exposure", score, weight: 0.10, explanation };
  }

  /**
   * Dimension 6 — Automated Sweeping / Non-Holding Mule Velocity (weight 5%)
   */
  private static scoreAutomatedSweepingVelocity(patterns: FraudPattern[], nodes: ForensicNode[]): RiskDimension {
    const sweepPattern = patterns.find(p => p.patternType === "VASP_SWEEPING");

    let score = 10;
    let explanation = "Normal wallet balance retention; funds are held without immediate liquidation.";

    if (sweepPattern) {
      score = sweepPattern.confidence;
      explanation = `Automated deposit sweeping confirmed (${sweepPattern.confidence}% conf): funds cleared within minutes, typical of disposable mule accounts.`;
    }

    return { name: "Rapid Sweeping & Mule Velocity", score, weight: 0.05, explanation };
  }

  /**
   * Independent Evaluation of VASP Attribution Confidence
   */
  static evaluateVaspAttribution(
    nodes: ForensicNode[],
    patterns: FraudPattern[]
  ): { confidence: number; methodology: string; exchangeName?: string } {
    const vaspNodes = nodes.filter(n =>
      n.entityType === "VASP_HOT_WALLET" ||
      n.entityType === "VASP_COLD_VAULT" ||
      n.entityType === "VASP_DEPOSIT_ADDRESS"
    );

    const directMatch = vaspNodes.find(n => n.entityName);
    const sweepPattern = patterns.find(p => p.patternType === "VASP_SWEEPING");

    if (directMatch) {
      return {
        confidence: 99.4,
        methodology: "DIRECT_HOT_WALLET_REGISTRY",
        exchangeName: directMatch.entityName,
      };
    }

    if (sweepPattern) {
      return {
        confidence: 88.5,
        methodology: "TWO_STEP_SWEEPING_HEURISTIC",
        exchangeName: "Centralized Exchange (Attributed via Deposit Sweep)",
      };
    }

    if (vaspNodes.length > 0) {
      return {
        confidence: 65.0,
        methodology: "DEPOSIT_CLUSTER",
      };
    }

    return {
      confidence: 15.0,
      methodology: "UNATTRIBUTED_NON_CUSTODIAL",
    };
  }
}
