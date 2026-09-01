import { BlockchainNetwork, TransactionRecord } from "../types";
import { globalTxCache } from "./lru-cache";

export interface AccountStateResult {
  address: string;
  network: BlockchainNetwork;
  balance: number;
  balanceUsd: number;
  totalReceived: number;
  totalSent: number;
  txCount: number;
  outgoingTransfers: TransactionRecord[];
  incomingTransfers: TransactionRecord[];
}

export class MultiChainForensicRouter {
  private blockchainComKey: string;
  private blockchainComUrl: string;

  constructor() {
    this.blockchainComKey = process.env.BLOCKCHAIN_COM_API_KEY || "expl_1MZodXaWAAxgJt2N7yiowl2yMZuaHHs1";
    this.blockchainComUrl = process.env.BLOCKCHAIN_COM_GATEWAY_URL || "https://api.blockchain.info/explorer-gateway-kt";
  }

  detectNetwork(address: string): BlockchainNetwork {
    const clean = address.trim();
    if (clean.startsWith("0x") && clean.length === 42) return "ETH";
    if (clean.startsWith("T") && clean.length === 34) return "TRON";
    if (clean.startsWith("bc1") || clean.startsWith("1") || clean.startsWith("3")) return "BTC";
    if (clean.length >= 32 && clean.length <= 44 && !clean.includes("0") && !clean.includes("O") && !clean.includes("I") && !clean.includes("l")) return "SOL";
    return "ETH";
  }

  /**
   * Bitcoin Live Ingestion via Blockchain.info Raw & Gateway
   */
  async queryBitcoinAccount(address: string): Promise<AccountStateResult> {
    const cacheKey = `btc:${address}`;
    const cached = globalTxCache.get(cacheKey);
    if (cached) return cached;

    const btcPriceUsd = 88000;
    const outgoing: TransactionRecord[] = [];
    const incoming: TransactionRecord[] = [];
    let balance = 0;
    let totalReceived = 0;
    let totalSent = 0;
    let txCount = 0;

    try {
      const url = `https://blockchain.info/rawaddr/${address}?limit=25`;
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (res.ok) {
        const data = await res.json();
        txCount = data.n_tx || 0;
        balance = (data.final_balance || 0) / 1e8;
        totalReceived = (data.total_received || 0) / 1e8;
        totalSent = (data.total_sent || 0) / 1e8;

        for (const tx of data.txs || []) {
          const txHash = tx.hash;
          const timestamp = tx.time ? new Date(tx.time * 1000).toISOString() : new Date().toISOString();
          const blockNumber = tx.block_height || 0;

          // Check if address is in inputs (outgoing)
          const isSender = (tx.inputs || []).some((inp: any) => inp.prev_out?.addr === address);
          if (isSender) {
            for (const out of tx.out || []) {
              if (out.addr && out.addr !== address) {
                const amountBtc = (out.value || 0) / 1e8;
                outgoing.push({
                  txHash,
                  fromAddress: address,
                  toAddress: out.addr,
                  amount: Math.round(amountBtc * btcPriceUsd * 100) / 100,
                  tokenSymbol: "BTC",
                  timestamp,
                  blockNumber,
                  network: "BTC",
                });
              }
            }
          } else {
            // Incoming
            let recvVal = 0;
            let sender = "External Sender";
            if (tx.inputs?.[0]?.prev_out?.addr) sender = tx.inputs[0].prev_out.addr;
            for (const out of tx.out || []) {
              if (out.addr === address) recvVal += (out.value || 0) / 1e8;
            }
            if (recvVal > 0) {
              incoming.push({
                txHash,
                fromAddress: sender,
                toAddress: address,
                amount: Math.round(recvVal * btcPriceUsd * 100) / 100,
                tokenSymbol: "BTC",
                timestamp,
                blockNumber,
                network: "BTC",
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn("[BTC Router] Query error:", err);
    }

    const result: AccountStateResult = {
      address,
      network: "BTC",
      balance,
      balanceUsd: Math.round(balance * btcPriceUsd * 100) / 100,
      totalReceived: Math.round(totalReceived * btcPriceUsd * 100) / 100,
      totalSent: Math.round(totalSent * btcPriceUsd * 100) / 100,
      txCount,
      outgoingTransfers: outgoing,
      incomingTransfers: incoming,
    };

    globalTxCache.set(cacheKey, result);
    return result;
  }

  /**
   * EVM Live Ingestion via Blockscout v2 REST (Ethereum, Polygon, Arbitrum, Optimism)
   */
  async queryEvmAccount(address: string, network: "ETH" | "POLYGON" | "BASE" = "ETH"): Promise<AccountStateResult> {
    const clean = address.toLowerCase();
    const cacheKey = `evm:${network}:${clean}`;
    const cached = globalTxCache.get(cacheKey);
    if (cached) return cached;

    const host = network === "POLYGON" ? "polygon.blockscout.com" : "eth.blockscout.com";
    const outgoing: TransactionRecord[] = [];
    const incoming: TransactionRecord[] = [];
    let balanceUsd = 0;
    let totalInflow = 0;
    let totalOutflow = 0;

    try {
      // 1. Fetch token transfers (ERC-20 USDT/USDC/DAI)
      const tokenUrl = `https://${host}/api/v2/addresses/${clean}/token-transfers`;
      const res = await fetch(tokenUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (res.ok) {
        const json = await res.json();
        for (const item of json.items || []) {
          const fromAddr = item.from?.hash?.toLowerCase() || "";
          const toAddr = item.to?.hash?.toLowerCase() || "";
          const rawVal = BigInt(item.total?.value || "0");
          const dec = Number(item.total?.decimals || 6);
          const val = Number(rawVal) / Math.pow(10, dec);
          const symbol = (item.token?.symbol || "USDT") as any;
          const timestamp = item.timestamp || new Date().toISOString();
          const blockNumber = Number(item.block_number || 0);
          const txHash = item.transaction_hash || "0x...";

          if (fromAddr === clean) {
            totalOutflow += val;
            outgoing.push({
              txHash,
              fromAddress: clean,
              toAddress: toAddr,
              amount: Math.round(val * 100) / 100,
              tokenSymbol: symbol,
              timestamp,
              blockNumber,
              network,
            });
          } else if (toAddr === clean) {
            totalInflow += val;
            incoming.push({
              txHash,
              fromAddress: fromAddr,
              toAddress: clean,
              amount: Math.round(val * 100) / 100,
              tokenSymbol: symbol,
              timestamp,
              blockNumber,
              network,
            });
          }
        }
      }

      // 2. Fetch native balance & account info
      const accUrl = `https://${host}/api/v2/addresses/${clean}`;
      const accRes = await fetch(accUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (accRes.ok) {
        const accJson = await accRes.json();
        const ethPrice = Number(accJson.exchange_rate || 2700);
        const ethBal = Number(BigInt(accJson.coin_balance || "0")) / 1e18;
        balanceUsd = Math.round(ethBal * ethPrice * 100) / 100;
      }
    } catch (err) {
      console.warn("[EVM Router] Query error:", err);
    }

    const result: AccountStateResult = {
      address: clean,
      network,
      balance: balanceUsd,
      balanceUsd,
      totalReceived: Math.round(totalInflow * 100) / 100,
      totalSent: Math.round(totalOutflow * 100) / 100,
      txCount: outgoing.length + incoming.length,
      outgoingTransfers: outgoing,
      incomingTransfers: incoming,
    };

    globalTxCache.set(cacheKey, result);
    return result;
  }

  /**
   * TRON Live Ingestion via TronScan REST
   */
  async queryTronAccount(address: string): Promise<AccountStateResult> {
    const cacheKey = `tron:${address}`;
    const cached = globalTxCache.get(cacheKey);
    if (cached) return cached;

    const outgoing: TransactionRecord[] = [];
    const incoming: TransactionRecord[] = [];
    let totalInflow = 0;
    let totalOutflow = 0;

    try {
      const url = `https://apilist.tronscan.org/api/token_trc20/transfers?limit=25&start=0&relatedAddress=${address}`;
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
      if (res.ok) {
        const json = await res.json();
        for (const t of json.token_transfers || []) {
          const fromAddr = t.from_address || "";
          const toAddr = t.to_address || "";
          const rawAmount = Number(t.quant || 0);
          const decimals = Number(t.tokenInfo?.tokenDecimal || 6);
          const val = rawAmount > 1e10 ? rawAmount / Math.pow(10, decimals) : rawAmount;
          const timestamp = t.block_ts ? new Date(t.block_ts).toISOString() : new Date().toISOString();
          const blockNumber = t.block || 0;
          const txHash = t.transaction_id || "0x...";

          if (fromAddr.toLowerCase() === address.toLowerCase()) {
            totalOutflow += val;
            outgoing.push({
              txHash,
              fromAddress: address,
              toAddress: toAddr,
              amount: Math.round(val * 100) / 100,
              tokenSymbol: "USDT",
              timestamp,
              blockNumber,
              network: "TRON",
            });
          } else {
            totalInflow += val;
            incoming.push({
              txHash,
              fromAddress: fromAddr,
              toAddress: address,
              amount: Math.round(val * 100) / 100,
              tokenSymbol: "USDT",
              timestamp,
              blockNumber,
              network: "TRON",
            });
          }
        }
      }
    } catch (err) {
      console.warn("[TRON Router] Query error:", err);
    }

    const result: AccountStateResult = {
      address,
      network: "TRON",
      balance: Math.max(0, totalInflow - totalOutflow),
      balanceUsd: Math.max(0, totalInflow - totalOutflow),
      totalReceived: Math.round(totalInflow * 100) / 100,
      totalSent: Math.round(totalOutflow * 100) / 100,
      txCount: outgoing.length + incoming.length,
      outgoingTransfers: outgoing,
      incomingTransfers: incoming,
    };

    globalTxCache.set(cacheKey, result);
    return result;
  }

  /**
   * Universal Dispatcher
   */
  async queryAccount(address: string, network?: BlockchainNetwork): Promise<AccountStateResult> {
    const net = network || this.detectNetwork(address);
    if (net === "BTC") return await this.queryBitcoinAccount(address);
    if (net === "TRON") return await this.queryTronAccount(address);
    return await this.queryEvmAccount(address, net === "POLYGON" ? "POLYGON" : "ETH");
  }
}

export const globalMultiChainRouter = new MultiChainForensicRouter();
