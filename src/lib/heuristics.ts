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
   * Evaluates if a given wallet address matches a known VASP entity or mixer
   */
  static identifyKnownEntity(address: string, network: string): {
    entityType: EntityType;
    name?: string;
    fiuRegistered?: boolean;
    fiuRegistrationNumber?: string;
    riskLevel: RiskLevel;
  } {
    const cleanAddr = address.toLowerCase();

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
   * Topological 2-step VASP Deposit Sweeping Heuristic
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

    const sorted = [...outgoingTxs].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const firstSweep = sorted[0];
    const sweptAmount = firstSweep.amount;
    const sweptRatio = (sweptAmount / inflowUsdt) * 100;

    const knownTarget = this.identifyKnownEntity(firstSweep.toAddress, network);
    const isHighSwept = sweptRatio >= 95;
    const isKnownVault = knownTarget.entityType === "VASP_HOT_WALLET" || knownTarget.entityType === "VASP_COLD_VAULT";

    if (isHighSwept || isKnownVault) {
      const exchangeName = knownTarget.name || "Centralized Exchange (VASP)";
      return {
        isSwept: true,
        microGasRefill: firstSweep.gasRefillDetected ?? true,
        gasAmount: firstSweep.gasRefillAmount ? `${firstSweep.gasRefillAmount} ${firstSweep.gasRefillAsset || "TRX"}` : "15 TRX (Micro-Gas Refill)",
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
