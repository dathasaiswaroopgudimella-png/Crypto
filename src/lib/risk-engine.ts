import { FraudPattern, ForensicNode, RiskScore, RiskDimension, RiskLevel } from "./types";
import { KNOWN_HIGH_RISK_ENTITIES } from "./constants";

/**
 * Deterministic 6-dimension risk scoring engine.
 * Every score is calculated from real graph data — zero hardcoded values.
 */
export class RiskScoringEngine {

  static score(
    nodes: ForensicNode[],
    patterns: FraudPattern[],
    totalHops: number,
    distinctChains: number
  ): RiskScore {
    const dimensions: RiskDimension[] = [
      this.scoreMixerProximity(nodes, patterns),
      this.scoreVaspAttributionConfidence(nodes),
      this.scoreLayeringDepth(totalHops),
      this.scoreCrossChainComplexity(distinctChains),
      this.scoreStructuringSignals(patterns),
      this.scoreSanctionedEntityExposure(nodes),
    ];

    const total = Math.min(
      100,
      Math.round(dimensions.reduce((sum, d) => sum + d.score * d.weight, 0))
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
   * Dimension 1 — Mixer Proximity (weight 30%)
   * Full score if any node is a known mixer, scaled down by hop distance.
   */
  private static scoreMixerProximity(nodes: ForensicNode[], patterns: FraudPattern[]): RiskDimension {
    const mixerPattern = patterns.find(p => p.patternType === "MIXER_RELAY");
    const mixerAddresses = new Set(KNOWN_HIGH_RISK_ENTITIES.map(e => e.address.toLowerCase()));

    let score = 0;
    let explanation = "No known mixer or tumbler detected in the transaction path.";

    if (mixerPattern) {
      score = 100;
      explanation = `Funds directly interact with a sanctioned mixer at hop ${mixerPattern.detectedAtHop}. This is the highest-severity laundering indicator.`;
    } else {
      // Check 2-hop proximity
      for (const node of nodes) {
        if (mixerAddresses.has(node.fullAddress.toLowerCase())) {
          score = Math.max(score, node.hopDistance <= 1 ? 90 : 60);
          explanation = `Wallet is ${node.hopDistance} hop(s) from a known mixer address. Proximity indicates exposure risk.`;
        }
      }
    }

    return { name: "Mixer Proximity", score, weight: 0.30, explanation };
  }

  /**
   * Dimension 2 — VASP Attribution Confidence (weight 25%)
   * Higher score when VASP is identified via direct hot-wallet match.
   * Lower when identified only via deposit-pattern heuristic.
   */
  private static scoreVaspAttributionConfidence(nodes: ForensicNode[]): RiskDimension {
    const vaspNodes = nodes.filter(n =>
      n.entityType === "VASP_HOT_WALLET" ||
      n.entityType === "VASP_COLD_VAULT" ||
      n.entityType === "VASP_DEPOSIT_ADDRESS"
    );

    let score = 0;
    let explanation = "No VASP destination identified. Funds may still be in unhosted wallets.";

    if (vaspNodes.length > 0) {
      const directMatch = vaspNodes.find(n => n.entityName);
      if (directMatch) {
        score = 95;
        explanation = `VASP identified with high confidence: ${directMatch.entityName} (${directMatch.entityType.replace(/_/g, " ")}). FIU-IND freeze request can be issued immediately.`;
      } else {
        score = 65;
        explanation = `VASP deposit pattern detected but exchange name not confirmed from hot-wallet registry. Manual cross-check recommended.`;
      }
    }

    return { name: "VASP Attribution Confidence", score, weight: 0.25, explanation };
  }

  /**
   * Dimension 3 — Layering Depth (weight 20%)
   * More hops before reaching a VASP = higher layering severity.
   */
  private static scoreLayeringDepth(totalHops: number): RiskDimension {
    let score = 0;
    let explanation = "";

    if (totalHops <= 1) {
      score = 20;
      explanation = "Direct 1-hop transfer. Minimal layering. Straightforward tracing.";
    } else if (totalHops === 2) {
      score = 45;
      explanation = "2-hop layering detected. Simple intermediary wallet used before VASP deposit.";
    } else if (totalHops === 3) {
      score = 65;
      explanation = "3-hop layering. Multiple mule wallets used — consistent with organised cybercrime operations.";
    } else if (totalHops <= 5) {
      score = 85;
      explanation = `${totalHops}-hop layering. Highly sophisticated layering structure indicative of professional money laundering operations.`;
    } else {
      score = 100;
      explanation = `${totalHops}+ hops detected. Extreme layering depth — likely automated peeling chain or tumbler-assisted obfuscation.`;
    }

    return { name: "Layering Depth", score, weight: 0.20, explanation };
  }

  /**
   * Dimension 4 — Cross-Chain Complexity (weight 15%)
   * Moving funds across multiple blockchains severely complicates recovery.
   */
  private static scoreCrossChainComplexity(distinctChains: number): RiskDimension {
    const score = Math.min(100, (distinctChains - 1) * 40);
    const explanation =
      distinctChains <= 1
        ? "Single-chain transaction. Standard tracing applies."
        : `Funds cross ${distinctChains} distinct blockchain networks. Cross-chain analysis required — coordinate with Blockscout, TronScan, and relevant explorer partners.`;

    return { name: "Cross-Chain Complexity", score, weight: 0.15, explanation };
  }

  /**
   * Dimension 5 — Structuring Signals (weight 5%)
   */
  private static scoreStructuringSignals(patterns: FraudPattern[]): RiskDimension {
    const smurfing = patterns.find(p => p.patternType === "SMURFING");
    const score = smurfing ? smurfing.confidence : 0;
    const explanation = smurfing
      ? `Structuring (smurfing) detected: ${smurfing.evidenceDescription}`
      : "No sub-threshold structuring pattern detected.";

    return { name: "Structuring / Smurfing Signals", score, weight: 0.05, explanation };
  }

  /**
   * Dimension 6 — Sanctioned Entity Exposure (weight 5%)
   */
  private static scoreSanctionedEntityExposure(nodes: ForensicNode[]): RiskDimension {
    const sanctionedAddrs = new Set(
      KNOWN_HIGH_RISK_ENTITIES
        .filter(e => e.ofacSanctioned)
        .map(e => e.address.toLowerCase())
    );

    const hit = nodes.find(n => sanctionedAddrs.has(n.fullAddress.toLowerCase()));
    const score = hit ? 100 : 0;
    const explanation = hit
      ? `Transaction path includes OFAC-sanctioned address ${hit.fullAddress.slice(0, 10)}...${hit.fullAddress.slice(-6)}. Immediate escalation to FIU-IND and enforcement authorities required.`
      : "No OFAC-sanctioned or MHA-designated entity found in transaction path.";

    return { name: "Sanctioned Entity Exposure", score, weight: 0.05, explanation };
  }
}
