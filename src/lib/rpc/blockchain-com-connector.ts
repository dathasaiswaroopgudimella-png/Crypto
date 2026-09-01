import { BlockchainNetwork, TransactionRecord } from "../types";
import { globalTxCache } from "./lru-cache";

export class BlockchainComConnector {
  private baseUrl: string;
  private apiKey: string;

  constructor(
    baseUrl: string = process.env.BLOCKCHAIN_COM_GATEWAY_URL || "https://api.blockchain.info/explorer-gateway-kt",
    apiKey: string = process.env.BLOCKCHAIN_COM_API_KEY || "expl_1MZodXaWAAxgJt2N7yiowl2yMZuaHHs1"
  ) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  /**
   * Queries Blockchain.com Explorer Gateway for address transactions (BTC / ETH)
   */
  async getAddressTransactions(address: string, network: "BTC" | "ETH" = "BTC", page: number = 0): Promise<TransactionRecord[]> {
    const cacheKey = `bcom:${network.toLowerCase()}:${address.toLowerCase()}:p${page}`;
    const cached = globalTxCache.get(cacheKey);
    if (cached) return cached;

    const chainPath = network === "BTC" ? "btc" : "eth";
    const url = `${this.baseUrl}/${chainPath}/address`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "X-Explorer-Auth-Key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          network,
          address,
          page,
        }),
      });

      if (!response.ok) {
        throw new Error(`Blockchain.com Gateway HTTP ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      const records: TransactionRecord[] = [];

      const txList = json.transactions || json.txs || [];
      for (const tx of txList) {
        const txHash = tx.hash || tx.txid || tx.transactionHash || `tx-${Date.now()}`;
        const timestamp = tx.time || tx.timestamp ? new Date(tx.time * 1000 || tx.timestamp).toISOString() : new Date().toISOString();
        const blockNumber = tx.blockHeight || tx.blockNumber || 0;
        
        let amount = 0;
        let toAddress = "Consolidation Vault";
        
        if (tx.outputs && Array.isArray(tx.outputs)) {
          for (const out of tx.outputs) {
            if (out.address && out.address.toLowerCase() !== address.toLowerCase()) {
              toAddress = out.address;
              amount += (Number(out.value || 0) / 1e8) * 90000; // rough BTC to USD approximation
            }
          }
        } else if (tx.value) {
          amount = Number(tx.value) / 1e18 * 2700; // ETH approximation
        }

        records.push({
          txHash,
          fromAddress: address,
          toAddress,
          amount: Math.round(amount * 100) / 100,
          tokenSymbol: network === "BTC" ? "BTC" : "ETH",
          timestamp,
          blockNumber,
          network,
        });
      }

      globalTxCache.set(cacheKey, records);
      return records;
    } catch (err) {
      console.warn(`[Blockchain.com Gateway] Live query failed for ${address}:`, err);
      return [];
    }
  }
}
