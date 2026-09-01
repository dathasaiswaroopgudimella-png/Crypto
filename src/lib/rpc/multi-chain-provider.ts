import { BlockchainNetwork, TransactionRecord } from "../types";
import { EvmConnector } from "./evm-connector";
import { TronConnector } from "./tron-connector";
import { BlockchainComConnector } from "./blockchain-com-connector";
import { BlockscoutConnector } from "./blockscout-connector";

export class UnifiedMultiChainProvider {
  private evmConnector: EvmConnector;
  private tronConnector: TronConnector;
  private blockchainComConnector: BlockchainComConnector;
  private blockscoutConnector: BlockscoutConnector;

  constructor() {
    this.evmConnector = new EvmConnector();
    this.tronConnector = new TronConnector();
    this.blockchainComConnector = new BlockchainComConnector();
    this.blockscoutConnector = new BlockscoutConnector();
  }

  /**
   * Detects blockchain network from wallet address structure
   */
  detectNetwork(address: string): BlockchainNetwork {
    const trimmed = address.trim();
    if (trimmed.startsWith("0x")) return "ETH";
    if (trimmed.startsWith("T") && trimmed.length === 34) return "TRON";
    if (trimmed.startsWith("bc1") || trimmed.startsWith("1") || trimmed.startsWith("3")) return "BTC";
    return "ETH";
  }

  /**
   * Universal outgoing transfer fetcher across EVM, TRON, and Bitcoin
   */
  async getOutgoingTransfers(address: string, network?: BlockchainNetwork): Promise<TransactionRecord[]> {
    const net = network || this.detectNetwork(address);

    if (net === "TRON") {
      return await this.tronConnector.getOutgoingTrc20Transfers(address);
    } else if (net === "BTC") {
      return await this.blockchainComConnector.getAddressTransactions(address, "BTC");
    } else {
      // For EVM chains, try Blockscout v2 first (fastest open REST), then fallback to Alchemy/RPC
      const blockscoutTxs = await this.blockscoutConnector.getTokenTransfers(address, net);
      if (blockscoutTxs.length > 0) return blockscoutTxs;

      return await this.evmConnector.getOutgoingTokenTransfers(address);
    }
  }
}

export const globalMultiChainProvider = new UnifiedMultiChainProvider();
