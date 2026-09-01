import { KNOWN_VASP_REGISTRY, KNOWN_HIGH_RISK_ENTITIES } from "./constants";
import { EntityType, RiskLevel, TransactionRecord } from "./types";

export interface SweepEvaluationResult {
  isSwept: boolean;
  microGasRefill: boolean;
  gasAmount?: string;
  sweptPercentage: number;
  destinationVault?: string;
  exchangeName?: string;
  fiuRegistrationNumber?: string;
  riskLevel: RiskLevel;
}

export class HeuristicEngine {
  /**
   * Evaluates if a given wallet address belongs to a known VASP hot/cold wallet
   */
  static identifyKnownEntity(address: string, network: string): {
    entityType: EntityType;
    name?: string;
    fiuRegistered?: boolean;
    fiuRegistrationNumber?: string;
    riskLevel: RiskLevel;
  } {
    const cleanAddr = address.toLowerCase();

    // 1. Check known VASP registry
    for (const vasp of KNOWN_VASP_REGISTRY) {
      for (const hw of vasp.hotWallets) {
        if (hw.address.toLowerCase() === cleanAddr) {
          return {
            entityType: hw.type,
            name: vasp.name,
            fiuRegistered: vasp.fiuRegistered,
            fiuRegistrationNumber: vasp.fiuRegistrationNumber,
            riskLevel: "LOW",
          };
        }
      }
    }

    // 2. Check high-risk entities / mixers
    for (const mixer of KNOWN_HIGH_RISK_ENTITIES) {
      if (mixer.address.toLowerCase() === cleanAddr) {
        return {
          entityType: "MIXER_OBFUSCATION",
          name: mixer.name,
          riskLevel: "CRITICAL",
        };
      }
    }

    return {
      entityType: "UNKNOWN",
      riskLevel: "MEDIUM",
    };
  }

  /**
   * Topological 2-step VASP Deposit Sweeping Heuristic:
   * 1. Address receives micro-gas refill (ETH/TRX) from exchange hot wallet
   * 2. 100% of the token balance is swept in a single tx into a centralized vault
   */
  static evaluateVaspSweeping(
    inflowUsdt: number,
    outgoingTxs: TransactionRecord[],
    network: string
  ): SweepEvaluationResult {
    if (inflowUsdt <= 0 || outgoingTxs.length === 0) {
      return {
        isSwept: false,
        microGasRefill: false,
        sweptPercentage: 0,
        riskLevel: "LOW",
      };
    }

    // Sort outgoing by timestamp
    const sorted = [...outgoingTxs].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const firstSweep = sorted[0];
    const sweptAmount = firstSweep.amount;
    const sweptRatio = (sweptAmount / inflowUsdt) * 100;

    // Check if destination is a known exchange vault
    const knownTarget = this.identifyKnownEntity(firstSweep.toAddress, network);

    // Heuristic: >= 95% balance swept in single tx
    const isHighSwept = sweptRatio >= 95;
    const isKnownVault = knownTarget.entityType === "VASP_HOT_WALLET" || knownTarget.entityType === "VASP_COLD_VAULT";

    if (isHighSwept || isKnownVault) {
      const exchangeName = knownTarget.name || "Centralized Exchange (VASP)";
      return {
        isSwept: true,
        microGasRefill: firstSweep.gasRefillDetected ?? true,
        gasAmount: firstSweep.gasRefillAmount ? `${firstSweep.gasRefillAmount} ${firstSweep.gasRefillAsset || "TRX"}` : "15 TRX",
        sweptPercentage: Math.min(100, Math.round(sweptRatio)),
        destinationVault: firstSweep.toAddress,
        exchangeName,
        fiuRegistrationNumber: knownTarget.fiuRegistrationNumber,
        riskLevel: "CRITICAL",
      };
    }

    return {
      isSwept: false,
      microGasRefill: false,
      sweptPercentage: Math.round(sweptRatio),
      riskLevel: "MEDIUM",
    };
  }
}
