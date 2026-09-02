import { FraudPattern, ForensicNode, ForensicEdge, PatternType, TransactionRecord } from "./types";
import { KNOWN_HIGH_RISK_ENTITIES, KNOWN_BRIDGE_CONTRACTS, KNOWN_VASP_REGISTRY } from "./constants";

/**
 * Detects all 7 fraud laundering patterns from a set of on-chain nodes and edges.
 * Every detector is fully deterministic — no randomness, no placeholders.
 */
export class FraudPatternDetector {

  /**
   * PATTERN 1 — Peeling Chain
   * Serial forwarding where each hop retains 70–99% of the previous balance,
   * leaking a small fee. Requires 2+ consecutive hops with diminishing balance.
   */
  static detectPeelingChain(nodes: ForensicNode[], edges: ForensicEdge[]): FraudPattern | null {
    const sortedByHop = [...nodes].sort((a, b) => a.hopDistance - b.hopDistance);
    let chainLength = 0;
    let prevAmount = 0;
    const involvedAddresses: string[] = [];

    for (const node of sortedByHop) {
      if (node.hopDistance === 0) {
        prevAmount = node.totalInflowUsd;
        involvedAddresses.push(node.fullAddress);
        continue;
      }
      const incomingEdge = edges.find(e => e.target.toLowerCase() === node.fullAddress.toLowerCase() || e.target === node.id);
      if (!incomingEdge || incomingEdge.amount <= 0 || prevAmount <= 0) continue;

      const ratio = incomingEdge.amount / prevAmount;
      // Peeling: each hop retains 70–99.5% (small fee leak, not a full sweep)
      if (ratio >= 0.70 && ratio < 0.995) {
        chainLength++;
        involvedAddresses.push(node.fullAddress);
        prevAmount = incomingEdge.amount;
      } else {
        chainLength = 0;
        prevAmount = incomingEdge.amount;
        involvedAddresses.length = 1;
        involvedAddresses[0] = node.fullAddress;
      }

      if (chainLength >= 2) {
        const confidence = Math.min(95, 60 + chainLength * 10);
        return {
          patternType: "PEELING_CHAIN",
          confidence,
          evidenceDescription: `${chainLength + 1}-hop serial forwarding detected where each hop retains ${Math.round(ratio * 100)}% of the previous amount. This is a textbook layering technique to obscure fund origin across ${chainLength + 1} distinct wallets.`,
          legislativeReference: "PMLA 2002 Section 3 (Money Laundering Offence) — Layering stage; FATF Typology: Structuring via Sequential Transfers",
          detectedAtHop: node.hopDistance,
          involvedAddresses: [...involvedAddresses],
        };
      }
    }
    return null;
  }

  /**
   * PATTERN 2 — VASP Sweeping
   * 85%+ of balance swept to a centralized exchange vault in a short window.
   * Excludes already known VASP hot wallets / exchange master vaults.
   */
  static detectVaspSweeping(
    inflowUsd: number,
    outgoingTxs: TransactionRecord[],
    hopIndex: number,
    sourceAddress?: string
  ): FraudPattern | null {
    if (inflowUsd <= 0 || outgoingTxs.length === 0) return null;

    // Do NOT flag if the source address is already a verified VASP Hot Wallet
    if (sourceAddress) {
      const cleanSrc = sourceAddress.toLowerCase();
      const isKnownVasp = KNOWN_VASP_REGISTRY.some(v =>
        v.hotWallets.some(hw => hw.address.toLowerCase() === cleanSrc)
      );
      if (isKnownVasp) return null;
    }

    const totalOut = outgoingTxs.reduce((s, t) => s + t.amount, 0);
    if (totalOut <= 0) return null;

    const effectiveForwarded = Math.min(totalOut, inflowUsd);
    const sweptRatio = (effectiveForwarded / inflowUsd) * 100;
    if (sweptRatio < 80) return null;

    const displayPercentage = Math.min(100, Math.round(sweptRatio));
    const topTx = [...outgoingTxs].sort((a, b) => b.amount - a.amount)[0];

    return {
      patternType: "VASP_SWEEPING",
      confidence: Math.min(98, Math.max(80, displayPercentage)),
      evidenceDescription: `${displayPercentage}% of received funds ($${effectiveForwarded.toLocaleString()}) rapidly forwarded in ${outgoingTxs.length} outgoing transaction(s). Primary destination: ${topTx.toAddress.slice(0, 8)}...${topTx.toAddress.slice(-6)}. Matches 2-step automated deposit sweeping into an exchange liquidity pool.`,
      legislativeReference: "PMLA 2002 Section 3 — Placement and Layering; FATF Guidance on VASP Exposure; FIU-IND Circular 2024",
      detectedAtHop: hopIndex,
      involvedAddresses: outgoingTxs.map(t => t.toAddress),
    };
  }

  /**
   * PATTERN 3 — Mixer Relay
   * Any hop passing through a known OFAC-sanctioned mixer or tumbler address.
   */
  static detectMixerRelay(nodes: ForensicNode[], edges: ForensicEdge[]): FraudPattern | null {
    const mixerAddresses = new Set(KNOWN_HIGH_RISK_ENTITIES.map(e => e.address.toLowerCase()));
    for (const node of nodes) {
      if (mixerAddresses.has(node.fullAddress.toLowerCase())) {
        const relatedEdges = edges.filter(
          e => e.target.toLowerCase() === node.fullAddress.toLowerCase() ||
               e.source.toLowerCase() === node.fullAddress.toLowerCase()
        );
        const entity = KNOWN_HIGH_RISK_ENTITIES.find(
          e => e.address.toLowerCase() === node.fullAddress.toLowerCase()
        );
        return {
          patternType: "MIXER_RELAY",
          confidence: 99,
          evidenceDescription: `Funds routed through ${entity?.name || "known mixer/tumbler"} (${node.fullAddress.slice(0, 8)}...${node.fullAddress.slice(-6)}). ${entity?.description || "This is a sanctioned obfuscation service."} ${entity?.ofacSanctioned ? "This address is on the OFAC SDN List." : ""}`,
          legislativeReference: "PMLA 2002 Section 3; OFAC SDN List (if applicable); IT Act 2000 Section 66; UN Security Council Resolution 1373",
          detectedAtHop: node.hopDistance,
          involvedAddresses: [node.fullAddress, ...relatedEdges.map(e => e.source), ...relatedEdges.map(e => e.target)],
        };
      }
    }
    return null;
  }

  /**
   * PATTERN 4 — Bridge Hop
   * Funds passing through a known cross-chain bridge contract, indicating
   * an attempt to move funds to a different blockchain ecosystem.
   */
  static detectBridgeHop(nodes: ForensicNode[], edges: ForensicEdge[]): FraudPattern | null {
    const bridgeMap = new Map(
      KNOWN_BRIDGE_CONTRACTS.map(b => [b.address.toLowerCase(), b])
    );
    for (const edge of edges) {
      const bridge = bridgeMap.get(edge.target.toLowerCase());
      if (bridge) {
        return {
          patternType: "BRIDGE_HOP",
          confidence: 97,
          evidenceDescription: `Funds sent to ${bridge.name} (${edge.target.slice(0, 8)}...${edge.target.slice(-6)}), a cross-chain bridge facilitating movement to ${bridge.destinationChains.join(", ")}. Cross-chain transfers are used to evade single-chain blockchain analytics and complicate asset recovery.`,
          legislativeReference: "PMLA 2002 Section 3 — Layering via Cross-Chain Transfers; FATF Guidance on Virtual Asset Cross-Chain Transfers (2023)",
          detectedAtHop: nodes.find(n => n.id === edge.source || n.fullAddress.toLowerCase() === edge.source.toLowerCase())?.hopDistance ?? 0,
          involvedAddresses: [edge.source, edge.target],
        };
      }
    }
    return null;
  }

  /**
   * PATTERN 5 — Smurfing / Structuring
   * Multiple small transactions to the same address that collectively
   * exceed a threshold, but individually stay below reporting limits.
   * Uses sub-$1000 individual amounts aggregating to $3000+.
   */
  static detectSmurfing(edges: ForensicEdge[]): FraudPattern | null {
    const recipientMap = new Map<string, ForensicEdge[]>();
    for (const edge of edges) {
      const key = edge.target.toLowerCase();
      if (!recipientMap.has(key)) recipientMap.set(key, []);
      recipientMap.get(key)!.push(edge);
    }

    for (const [recipient, txs] of recipientMap.entries()) {
      if (txs.length < 3) continue;
      const smallTxs = txs.filter(t => t.amount > 0 && t.amount < 1500);
      if (smallTxs.length < 3) continue;
      const totalSmall = smallTxs.reduce((s, t) => s + t.amount, 0);
      if (totalSmall < 3000) continue;

      return {
        patternType: "SMURFING",
        confidence: 85,
        evidenceDescription: `${smallTxs.length} separate transactions each below $1,500 sent to ${recipient.slice(0, 8)}...${recipient.slice(-6)}, aggregating to $${totalSmall.toLocaleString()}. This structuring pattern is designed to avoid transaction reporting thresholds and is a recognised AML red flag under FATF Recommendation 20.`,
        legislativeReference: "PMLA 2002 Section 12 — Reporting Obligations; FATF Recommendation 20 — Structuring / Smurfing; RBI Master Direction on KYC 2016",
        detectedAtHop: 0,
        involvedAddresses: [recipient, ...smallTxs.map(t => t.source)],
      };
    }
    return null;
  }

  /**
   * PATTERN 6 — Round-Trip Wash
   * Funds that return to an address in the same cluster as the origin.
   */
  static detectRoundTripWash(nodes: ForensicNode[], edges: ForensicEdge[]): FraudPattern | null {
    const root = nodes.find(n => n.hopDistance === 0);
    if (!root) return null;

    const rootAddr = root.fullAddress.toLowerCase();
    for (const edge of edges) {
      if (
        edge.target.toLowerCase() === rootAddr &&
        edge.source.toLowerCase() !== rootAddr
      ) {
        return {
          patternType: "ROUND_TRIP_WASH",
          confidence: 88,
          evidenceDescription: `Funds returned to the origin address ${root.fullAddress.slice(0, 8)}...${root.fullAddress.slice(-6)} after passing through ${nodes.length - 1} intermediate wallets. Round-trip movements are used to simulate legitimate trading activity and disguise the illicit origin of funds.`,
          legislativeReference: "PMLA 2002 Section 3 — Integration stage of Money Laundering; FATF Typology: Round-Tripping",
          detectedAtHop: nodes.find(n => n.id === edge.source || n.fullAddress.toLowerCase() === edge.source.toLowerCase())?.hopDistance ?? 1,
          involvedAddresses: [edge.source, edge.target],
        };
      }
    }
    return null;
  }

  /**
   * PATTERN 7 — Cross-Chain Hop
   * Detected when node asset network differs from root address network.
   */
  static detectCrossChainHop(nodes: ForensicNode[]): FraudPattern | null {
    const root = nodes.find(n => n.hopDistance === 0);
    if (!root) return null;

    const differentChainNodes = nodes.filter(
      n => n.hopDistance > 0 && n.network !== root.network && n.network !== "UNKNOWN"
    );
    if (differentChainNodes.length === 0) return null;

    const chainsSeen = [...new Set(differentChainNodes.map(n => n.network))];
    return {
      patternType: "CROSS_CHAIN_HOP",
      confidence: 88,
      evidenceDescription: `Funds originated on ${root.network} but trail extends to ${chainsSeen.join(", ")} — indicating cross-chain movement. This complicates asset tracing and recovery as it requires coordination across multiple blockchain jurisdictions and analytics providers.`,
      legislativeReference: "PMLA 2002 Section 3; FATF Updated Guidance for Virtual Assets (2023) — Cross-Chain Transfers",
      detectedAtHop: differentChainNodes[0].hopDistance,
      involvedAddresses: differentChainNodes.map(n => n.fullAddress),
    };
  }

  /**
   * Run all 7 detectors and return every pattern found.
   */
  static detectAll(
    nodes: ForensicNode[],
    edges: ForensicEdge[],
    rootInflow: number,
    outgoingTxs: TransactionRecord[],
    rootAddress?: string
  ): FraudPattern[] {
    const patterns: FraudPattern[] = [];

    const peeling = this.detectPeelingChain(nodes, edges);
    if (peeling) patterns.push(peeling);

    const sweeping = this.detectVaspSweeping(rootInflow, outgoingTxs, 0, rootAddress);
    if (sweeping) patterns.push(sweeping);

    const mixer = this.detectMixerRelay(nodes, edges);
    if (mixer) patterns.push(mixer);

    const bridge = this.detectBridgeHop(nodes, edges);
    if (bridge) patterns.push(bridge);

    const smurfing = this.detectSmurfing(edges);
    if (smurfing) patterns.push(smurfing);

    const roundTrip = this.detectRoundTripWash(nodes, edges);
    if (roundTrip) patterns.push(roundTrip);

    const crossChain = this.detectCrossChainHop(nodes);
    if (crossChain) patterns.push(crossChain);

    return patterns;
  }
}
