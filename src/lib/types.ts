export type BlockchainNetwork =
  | "ETH"
  | "TRON"
  | "BTC"
  | "POLYGON"
  | "BASE"
  | "SOL"
  | "BSC"
  | "ARBITRUM"
  | "OPTIMISM"
  | "AVALANCHE"
  | "UNKNOWN";

export type EntityType =
  | "SUSPECT"
  | "VICTIM"
  | "MULE_WALLET"
  | "MIXER_OBFUSCATION"
  | "BRIDGE_CONTRACT"
  | "VASP_DEPOSIT_ADDRESS"
  | "VASP_HOT_WALLET"
  | "VASP_COLD_VAULT"
  | "UNKNOWN";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type PatternType =
  | "PEELING_CHAIN"
  | "VASP_SWEEPING"
  | "MIXER_RELAY"
  | "BRIDGE_HOP"
  | "SMURFING"
  | "ROUND_TRIP_WASH"
  | "CROSS_CHAIN_HOP";

export interface FraudPattern {
  patternType: PatternType;
  confidence: number; // 0–100
  evidenceDescription: string;
  legislativeReference: string;
  detectedAtHop: number;
  involvedAddresses: string[];
}

export interface RiskDimension {
  name: string;
  score: number; // 0–100
  weight: number; // 0–1
  explanation: string;
}

export interface RiskScore {
  total: number; // weighted composite 0–100
  level: RiskLevel;
  dimensions: RiskDimension[];
  generatedAtUtc: string;
}

export interface CrossChainHop {
  fromChain: BlockchainNetwork;
  toChain: BlockchainNetwork;
  bridgeAddress: string;
  bridgeName: string;
  hopIndex: number;
  estimatedAmount: number;
  originTxHash?: string;
  destTxHash?: string;
  destWalletAddress?: string;
  bridgeProtocol?: string;
  continuationSuccess?: boolean;
}

export interface AssetDetectionResult {
  network: BlockchainNetwork;
  chainName: string;
  asset: string;
  standard: string;
  confidence: string;
  explorerUrl: string;
}

export interface TransactionRecord {
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
  tokenSymbol: string;
  timestamp: string;
  blockNumber: number;
  network: BlockchainNetwork;
  gasRefillDetected?: boolean;
  gasRefillAmount?: number;
  gasRefillAsset?: string;
  isSweepingTx?: boolean;
  isBridgeTx?: boolean;
  bridgeName?: string;
  explorerUrl?: string;
  apiSource?: string;
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
  riskScore?: RiskScore;
  hopDistance: number;
  totalInflowUsd: number;
  totalOutflowUsd: number;
  balanceUsd: number;
  isDestinationVault: boolean;
  clusterTag?: string; // groups addresses controlled by same entity
  detectedPatterns?: PatternType[];
  assetDetails?: AssetDetectionResult;
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
  isBridgeTx?: boolean;
  bridgeName?: string;
  detectedPatterns?: PatternType[];
  blockNumber?: number;
  explorerUrl?: string;
  methodName?: string;
  feeUsd?: number;
  apiSource?: string;
}

export interface VaspAttributionResult {
  name: string;
  legalEntity?: string;
  depositAddress: string;
  vaultAddress: string;
  fiuRegistered: boolean;
  fiuNumber?: string;
  complianceEmail: string;
  nodalOfficer?: string;
  jurisdiction?: string;
  freezeRequestEmail?: string;
  detectedAt: string;
  confidenceScore: number; // 0–100%
  attributionMethod:
    | "DIRECT_HOT_WALLET_REGISTRY"
    | "TWO_STEP_SWEEPING_HEURISTIC"
    | "DEPOSIT_CLUSTER"
    | "INTER_LEDGER_CONTINUATION"
    | "HOT_WALLET_MATCH"
    | "DEPOSIT_PATTERN"
    | "BEHAVIORAL_CLUSTER";
  technicalEvidence?: string;
}

export interface GraphTraceResult {
  rootAddress: string;
  network: BlockchainNetwork;
  detectedAsset?: AssetDetectionResult;
  nodes: ForensicNode[];
  edges: ForensicEdge[];
  maxHops: number;
  traversalDurationMs: number;
  totalVolumeTrackedUsd: number;
  detectedPatterns: FraudPattern[];
  overallRiskScore?: RiskScore;
  criminalRiskScore?: RiskScore;
  destinationVasp?: VaspAttributionResult;
  vaspAttribution?: VaspAttributionResult;
  crossChainHops: CrossChainHop[];
  focusPathNodeIds?: string[];
  focusPathEdgeIds?: string[];
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
    detectedPatterns: string[];
    riskScore: number;
  };
  statutoryDirectives: string[];
  cryptographicVerification: {
    sha256Hash: string;
    extractionBlockNumber: number;
    bsaSection63Clause: string;
  };
}
