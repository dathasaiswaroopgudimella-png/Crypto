import { BlockchainNetwork, TransactionRecord } from "../types";
import { globalTxCache } from "./lru-cache";
import { CONTRACT_ADDRESSES } from "../constants";

export class MultiChainForensicRouter {
  private blockchainComKey: string;
  private blockchainComUrl: string;

  constructor() {
    this.blockchainComKey = process.env.BLOCKCHAIN_COM_API_KEY || "expl_1MZodXaWAAxgJt2N7yiowl2yMZuaHHs1";
    this.blockchainComUrl = process.env.BLOCKCHAIN_COM_GATEWAY_URL || "https://api.blockchain.info/explorer-gateway-kt";
  }

  detectNetwork(address: string): BlockchainNetwork {
    const clean = address.trim();
    if (clean.startsWith("0x")) return "ETH";
    if (clean.startsWith("T") && clean.length === 34) return "TRON";
    if (clean.startsWith("bc1") || clean.startsWith("1") || clean.startsWith("3")) return "BTC";
    return "ETH";
  }

  /**
   * TRON TRC-20 USDT Token Transfers Query
   */
  async queryTronTransfers(address: string): Promise<TransactionRecord[]> {
    const cacheKey = `tron:${address}`;
    const cached = globalTxCache.get(cacheKey);
    if (cached) return cached;

    try {
      const url = `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20?contract_address=${CONTRACT_ADDRESSES.TRON_USDT}&only_from=true&limit=25`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        next: { revalidate: 30 },
      });

      if (!res.ok) return [];

      const json = await res.json();
      const records: TransactionRecord[] = [];

      for (const tx of json.data || []) {
        const raw = BigInt(tx.value || "0");
        const dec = tx.token_info?.decimals || 6;
        const usdtAmount = Number(raw) / Math.pow(10, dec);

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
    } catch {
      return [];
    }
  }

  /**
   * EVM Blockscout v2 Token Transfers Query
   */
  async queryEvmTransfers(address: string, network: "ETH" | "POLYGON" | "BASE" = "ETH"): Promise<TransactionRecord[]> {
    const cacheKey = `evm:${network}:${address.toLowerCase()}`;
    const cached = globalTxCache.get(cacheKey);
    if (cached) return cached;

    const baseHost = network === "POLYGON" ? "polygon.blockscout.com" : (network === "BASE" ? "base.blockscout.com" : "eth.blockscout.com");

    try {
      const url = `https://${baseHost}/api/v2/addresses/${address}/token-transfers?type=ERC-20`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return [];

      const json = await res.json();
      const records: TransactionRecord[] = [];

      for (const item of json.items || []) {
        if (item.from?.hash?.toLowerCase() === address.toLowerCase()) {
          const rawVal = BigInt(item.total?.value || "0");
          const dec = Number(item.total?.decimals || 6);
          const usdtAmount = Number(rawVal) / Math.pow(10, dec);

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
    } catch {
      return [];
    }
  }

  /**
   * Bitcoin Blockchain.com Gateway Query
   */
  async queryBitcoinTransfers(address: string): Promise<TransactionRecord[]> {
    const cacheKey = `btc:${address}`;
    const cached = globalTxCache.get(cacheKey);
    if (cached) return cached;

    try {
      const res = await fetch(`${this.blockchainComUrl}/btc/address`, {
        method: "POST",
        headers: {
          "X-Explorer-Auth-Key": this.blockchainComKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ network: "BTC", address, page: 0 }),
      });

      if (!res.ok) return [];

      const json = await res.json();
      const records: TransactionRecord[] = [];

      for (const tx of json.transactions || json.txs || []) {
        let amount = 0;
        let toAddress = "Exchange Deposit";

        if (tx.outputs && Array.isArray(tx.outputs)) {
          for (const out of tx.outputs) {
            if (out.address && out.address.toLowerCase() !== address.toLowerCase()) {
              toAddress = out.address;
              amount += (Number(out.value || 0) / 1e8) * 88000;
            }
          }
        }

        records.push({
          txHash: tx.hash || tx.txid || "0x...",
          fromAddress: address,
          toAddress,
          amount: Math.round(amount * 100) / 100,
          tokenSymbol: "BTC",
          timestamp: tx.time ? new Date(tx.time * 1000).toISOString() : new Date().toISOString(),
          blockNumber: tx.blockHeight || 0,
          network: "BTC",
        });
      }

      globalTxCache.set(cacheKey, records);
      return records;
    } catch {
      return [];
    }
  }

  /**
   * Universal Dispatcher
   */
  async getOutgoingTransfers(address: string, network?: BlockchainNetwork): Promise<TransactionRecord[]> {
    const net = network || this.detectNetwork(address);
    if (net === "TRON") return await this.queryTronTransfers(address);
    if (net === "BTC") return await this.queryBitcoinTransfers(address);
    return await this.queryEvmTransfers(address, net === "POLYGON" ? "POLYGON" : "ETH");
  }
}

export const globalMultiChainRouter = new MultiChainForensicRouter();
