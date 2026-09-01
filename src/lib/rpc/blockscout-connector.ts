import { BlockchainNetwork, TransactionRecord } from "../types";
import { globalTxCache } from "./lru-cache";

export class BlockscoutConnector {
  private baseUrls: Record<string, string> = {
    ETH: process.env.BLOCKSCOUT_ETH_API_URL || "https://eth.blockscout.com/api/v2",
    POLYGON: process.env.BLOCKSCOUT_POLYGON_API_URL || "https://polygon.blockscout.com/api/v2",
    BASE: process.env.BLOCKSCOUT_BASE_API_URL || "https://base.blockscout.com/api/v2",
  };

  /**
   * Queries Blockscout v2 REST API for token transfers from an address
   */
  async getTokenTransfers(address: string, network: BlockchainNetwork = "ETH"): Promise<TransactionRecord[]> {
    const baseUrl = this.baseUrls[network] || this.baseUrls.ETH;
    const cacheKey = `bscout:${network}:${address.toLowerCase()}`;
    const cached = globalTxCache.get(cacheKey);
    if (cached) return cached;

    const url = `${baseUrl}/addresses/${address}/token-transfers?type=ERC-20`;

    try {
      const res = await fetch(url, {
        headers: { "Accept": "application/json" },
      });

      if (!res.ok) {
        throw new Error(`Blockscout HTTP error ${res.status}`);
      }

      const json = await res.json();
      const items = json.items || [];
      const records: TransactionRecord[] = [];

      for (const item of items) {
        if (item.from && item.from.hash && item.from.hash.toLowerCase() === address.toLowerCase()) {
          const rawVal = BigInt(item.total?.value || "0");
          const decimals = Number(item.total?.decimals || 6);
          const usdtAmount = Number(rawVal) / Math.pow(10, decimals);

          records.push({
            txHash: item.transaction_hash,
            fromAddress: address.toLowerCase(),
            toAddress: item.to?.hash?.toLowerCase() || "0x...",
            amount: usdtAmount,
            tokenSymbol: (item.token?.symbol || "USDT") as any,
            timestamp: item.timestamp || new Date().toISOString(),
            blockNumber: Number(item.block_number || 0),
            network,
          });
        }
      }

      globalTxCache.set(cacheKey, records);
      return records;
    } catch (err) {
      console.warn(`[Blockscout Connector] Fallback for ${address}:`, err);
      return [];
    }
  }
}
