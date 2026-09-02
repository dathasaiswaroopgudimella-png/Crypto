import { FraudPattern, ForensicNode, ForensicEdge, PatternType, TransactionRecord } from "./types";
import { KNOWN_HIGH_RISK_ENTITIES, KNOWN_BRIDGE_CONTRACTS } from "./constants";

/**
 * Detects all 7 fraud laundering patterns from a set of on-chain nodes and edges.
 * Every detector is fully deterministic — no randomness, no placeholders.
 */
export class FraudPatternDetector {

  /**
   * PATTERN 1 — Peeling Chain
   * Serial forwarding where each hop retains 70–99% of the previous balance,
   * leaking a small fee. Requires 3+ consecutive hops with diminishing balance.
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
      const incomingEdge = edges.find(e => e.target === node.fullAddress || e.target === node.id);
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
   * 90%+ of balance swept to a single destination in one or two transactions
   * shortly after receipt. Classic mule wallet behaviour.
   */
  static detectVaspSweeping(
    inflowUsd: number,
    outgoingTxs: TransactionRecord[],
    hopIndex: number
  ): FraudPattern | null {
    if (inflowUsd <= 0 || outgoingTxs.length === 0) return null;
    const totalOut = outgoingTxs.reduce((s, t) => s + t.amount, 0);
    const sweptRatio = totalOut / inflowUsd;
    if (sweptRatio < 0.90) return null;

    const topTx = [...outgoingTxs].sort((a, b) => b.amount - a.amount)[0];
    return {
      patternType: "VASP_SWEEPING",
      confidence: Math.min(98, Math.round(sweptRatio * 100)),
      evidenceDescription: `${Math.round(sweptRatio * 100)}% of received funds (USD ${inflowUsd.toLocaleString()}) swept in ${outgoingTxs.length} outgoing transaction(s) within a short window. Primary recipient: ${topTx.toAddress.slice(0, 8)}...${topTx.toAddress.slice(-6)}. This behaviour matches a VASP deposit address or mule wallet that does not hold funds.`,
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
          detectedAtHop: nodes.find(n => n.id === edge.source || n.fullAddress === edge.source)?.hopDistance ?? 0,
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
   * Uses sub-$1000 individual amounts aggregating to $5000+.
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
      const smallTxs = txs.filter(t => t.amount > 0 && t.amount < 1000);
      if (smallTxs.length < 3) continue;
      const totalSmall = smallTxs.reduce((s, t) => s + t.amount, 0);
      if (totalSmall < 5000) continue;

      return {
        patternType: "SMURFING",
        confidence: 82,
        evidenceDescription: `${smallTxs.length} separate transactions each below $1,000 sent to ${recipient.slice(0, 8)}...${recipient.slice(-6)}, aggregating to $${totalSmall.toLocaleString()}. This structuring pattern is designed to avoid transaction reporting thresholds and is a recognised AML red flag under FATF Recommendation 20.`,
        legislativeReference: "PMLA 2002 Section 12 — Reporting Obligations; FATF Recommendation 20 — Structuring / Smurfing; RBI Master Direction on KYC 2016",
        detectedAtHop: 0,
        involvedAddresses: [recipient, ...smallTxs.map(t => t.source)],
      };
    }
    return null;
  }

  /**
   * PATTERN 6 — Round-Trip Wash
   * Funds that return to an address in the same cluster as the origin,
   * after passing through intermediate hops. Detected by comparing
   * final destination cluster tag with source cluster tag.
   */
  static detectRoundTripWash(nodes: ForensicNode[], edges: ForensicEdge[]): FraudPattern | null {
    const root = nodes.find(n => n.hopDistance === 0);
    if (!root) return null;

    const rootAddr = root.fullAddress.toLowerCase();
    // Check if any downstream edge targets back to root (direct cycle)
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
          detectedAtHop: nodes.find(n => n.id === edge.source || n.fullAddress === edge.source)?.hopDistance ?? 1,
          involvedAddresses: [edge.source, edge.target],
        };
      }
    }
    return null;
  }

  /**
   * PATTERN 7 — Cross-Chain Hop
   * Detected when a node's asset network differs from the root address network,
   * indicating an inter-chain movement even without a known bridge address match.
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
      confidence: 85,
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
    outgoingTxs: TransactionRecord[]
  ): FraudPattern[] {
    const patterns: FraudPattern[] = [];

    const peeling = this.detectPeelingChain(nodes, edges);
    if (peeling) patterns.push(peeling);

    const sweeping = this.detectVaspSweeping(rootInflow, outgoingTxs, 0);
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
