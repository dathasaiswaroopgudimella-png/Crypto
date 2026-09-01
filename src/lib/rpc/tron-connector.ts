import { TransactionRecord } from "../types";
import { globalTxCache } from "./lru-cache";
import { CONTRACT_ADDRESSES } from "../constants";

export class TronConnector {
  private baseUrl: string;
  private apiKey?: string;

  constructor(
    baseUrl: string = process.env.NEXT_PUBLIC_TRON_RPC_URL || "https://api.trongrid.io",
    apiKey?: string
  ) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey || process.env.TRONGRID_API_KEY;
  }

  /**
   * Queries TronGrid REST API for TRC-20 USDT token transfers for an address
   */
  async getOutgoingTrc20Transfers(walletAddress: string): Promise<TransactionRecord[]> {
    const cacheKey = `tron:out:${walletAddress}`;
    const cached = globalTxCache.get(cacheKey);
    if (cached) return cached;

    try {
      const url = `${this.baseUrl}/v1/accounts/${walletAddress}/transactions/trc20?contract_address=${CONTRACT_ADDRESSES.TRON_USDT}&only_from=true&limit=50`;
      const headers: Record<string, string> = {
        "Accept": "application/json",
      };
      if (this.apiKey) {
        headers["TRON-PRO-API-KEY"] = this.apiKey;
      }

      const res = await fetch(url, { headers, next: { revalidate: 30 } });
      if (!res.ok) {
        throw new Error(`TronGrid response status ${res.status}`);
      }

      const json = await res.json();
      const data = json.data || [];
      const records: TransactionRecord[] = [];

      for (const tx of data) {
        const rawAmount = BigInt(tx.value || "0");
        const decimals = tx.token_info?.decimals || 6;
        const usdtAmount = Number(rawAmount) / Math.pow(10, decimals);

        records.push({
          txHash: tx.transaction_id,
          fromAddress: tx.from,
          toAddress: tx.to,
          amount: usdtAmount,
          tokenSymbol: "USDT",
          timestamp: new Date(tx.block_timestamp).toISOString(),
          blockNumber: tx.block_timestamp,
          network: "TRON",
        });
      }

      globalTxCache.set(cacheKey, records);
      return records;
    } catch (err) {
      console.warn(`[TRON Connector] Query fallback for ${walletAddress}:`, err);
      return [];
    }
  }
}
