import { ethers } from "ethers";
import { TransactionRecord } from "../types";
import { globalTxCache } from "./lru-cache";
import { CONTRACT_ADDRESSES } from "../constants";

const ERC20_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export class EvmConnector {
  private rpcUrl: string;
  private provider: ethers.JsonRpcProvider;

  constructor(rpcUrl: string = process.env.NEXT_PUBLIC_EVM_RPC_URL || "https://cloudflare-eth.com") {
    this.rpcUrl = rpcUrl;
    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
  }

  /**
   * Fetches outgoing ERC-20 USDT transfer events for a given address
   */
  async getOutgoingTokenTransfers(walletAddress: string, lookbackBlocks: number = 2000): Promise<TransactionRecord[]> {
    const cacheKey = `evm:out:${walletAddress.toLowerCase()}`;
    const cached = globalTxCache.get(cacheKey);
    if (cached) return cached;

    try {
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - lookbackBlocks);
      const paddedSender = ethers.zeroPadValue(walletAddress, 32);

      const filter = {
        address: CONTRACT_ADDRESSES.ETH_USDT,
        topics: [
          ERC20_TRANSFER_TOPIC,
          paddedSender, // Topic 1: from
        ],
        fromBlock,
        toBlock: currentBlock,
      };

      const logs = await this.provider.getLogs(filter);
      const records: TransactionRecord[] = [];

      for (const log of logs) {
        if (log.topics.length >= 3) {
          const toAddress = ethers.dataSlice(log.topics[2], 12);
          const rawAmount = BigInt(log.data);
          const usdtAmount = Number(rawAmount) / 1e6; // USDT has 6 decimals

          const block = await this.provider.getBlock(log.blockNumber);
          const timestamp = block ? new Date(block.timestamp * 1000).toISOString() : new Date().toISOString();

          records.push({
            txHash: log.transactionHash,
            fromAddress: walletAddress.toLowerCase(),
            toAddress: toAddress.toLowerCase(),
            amount: usdtAmount,
            tokenSymbol: "USDT",
            timestamp,
            blockNumber: log.blockNumber,
            network: "ETH",
          });
        }
      }

      globalTxCache.set(cacheKey, records);
      return records;
    } catch (err) {
      console.warn(`[EVM Connector] Falling back on live query for ${walletAddress}:`, err);
      return [];
    }
  }
}
