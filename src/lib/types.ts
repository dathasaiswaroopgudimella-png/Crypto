export type BlockchainNetwork = "ETH" | "TRON" | "BTC" | "SOL" | "POLYGON" | "BASE" | "BSC";

export type EntityType = 
  | "VICTIM" 
  | "MULE_WALLET" 
  | "MIXER_OBFUSCATION" 
  | "VASP_DEPOSIT_ADDRESS" 
  | "VASP_HOT_WALLET" 
  | "VASP_COLD_VAULT" 
  | "UNKNOWN";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface TransactionRecord {
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: number; // in USDT / USD / token value
  tokenSymbol: "USDT" | "USDC" | "ETH" | "TRX" | "BTC" | "SOL";
  timestamp: string; // ISO 8601 UTC
  blockNumber: number;
  network: BlockchainNetwork;
  gasRefillDetected?: boolean;
  gasRefillTxHash?: string;
  gasRefillAmount?: number;
  gasRefillAsset?: string;
  isSweepingTx?: boolean;
  peelChainRatio?: number;
}

export interface ForensicNode {
  id: string;
  label: string;
  fullAddress: string;
  network: BlockchainNetwork;
  entityType: EntityType;
  entityName?: string;
  fiuRegistered?: boolean;
  riskLevel: RiskLevel;
  hopDistance: number;
  totalInflowUsd: number;
  totalOutflowUsd: number;
  balanceUsd: number;
  isDestinationVault: boolean;
  sweepDetails?: {
    microGasRefill: boolean;
    gasRefillSource?: string;
    gasAmount?: string;
    sweptPercentage: number;
    destinationVault: string;
    exchangeName: string;
    fiuRegistrationNumber?: string;
  };
}

export interface ForensicEdge {
  id: string;
  source: string;
  target: string;
  amount: number;
  tokenSymbol: string;
  timestamp: string;
  txHash: string;
  network: BlockchainNetwork;
  isPrimaryFlow: boolean;
  isSweeping: boolean;
}

export interface GraphTraceResult {
  rootAddress: string;
  network: BlockchainNetwork;
  nodes: ForensicNode[];
  edges: ForensicEdge[];
  maxHops: number;
  traversalDurationMs: number;
  totalVolumeTrackedUsd: number;
  destinationVasp?: {
    name: string;
    depositAddress: string;
    vaultAddress: string;
    fiuRegistered: boolean;
    fiuNumber?: string;
    complianceEmail: string;
    detectedAt: string;
    confidenceScore: number;
  };
  highRiskEntitiesFound: string[];
  sha256StateHash: string;
  generatedAtUtc: string;
}

export interface Section94NoticeData {
  noticeId: string;
  date: string;
  investigatingOfficer: {
    name: string;
    designation: string;
    policeStation: string;
    district: string;
    state: string;
    contactEmail: string;
    contactPhone: string;
  };
  complaintDetails: {
    ackNumber1930: string;
    crimeDate: string;
    victimName: string;
    stolenAmountInr: number;
    stolenAmountUsdt: number;
    sourceBankOrAccount: string;
    suspectInitialAddress: string;
  };
  vaspRecipient: {
    name: string;
    fiuNumber?: string;
    legalEntityName: string;
    complianceEmail: string;
    nodalOfficerName?: string;
  };
  forensicTrail: {
    depositAddress: string;
    depositTxHash: string;
    depositAmountUsdt: number;
    depositTimestampUtc: string;
    vaultSweptTo: string;
    hopPath: string[];
  };
  statutoryDirectives: string[];
  cryptographicVerification: {
    sha256Hash: string;
    extractionBlockNumber: number;
    bsaSection63Clause: string;
  };
}

export type ActiveTab = "overview" | "graph" | "wallet" | "vasp" | "cases";
