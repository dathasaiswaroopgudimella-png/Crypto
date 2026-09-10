import { BlockchainNetwork, TransactionRecord, AssetDetectionResult } from "../types";
import { globalTxCache } from "./lru-cache";

export interface AccountStateResult {
  address: string;
  network: BlockchainNetwork;
  detectedAsset: AssetDetectionResult;
  balance: number;
  balanceUsd: number;
  totalReceived: number;
  totalSent: number;
  txCount: number;
  outgoingTransfers: TransactionRecord[];
  incomingTransfers: TransactionRecord[];
}

export function detectCryptoAsset(address: string): AssetDetectionResult {
  const clean = address.trim();
  if (clean.startsWith("0x") && clean.length >= 40 && clean.length <= 44) {
    return {
      network: "ETH",
      chainName: "Ethereum & EVM Compatible",
      asset: "Ether (ETH) / Tether (USDT) / USDC",
      standard: "ERC-20 / EVM",
      confidence: "100%",
      explorerUrl: `https://eth.blockscout.com/address/${clean}`,
    };
  } else if (clean.startsWith("T") && clean.length === 34) {
    return {
      network: "TRON",
      chainName: "TRON Network",
      asset: "Tether (USDT-TRC20) / Tronix (TRX)",
      standard: "TRC-20 / TRC-10",
      confidence: "100%",
      explorerUrl: `https://tronscan.org/#/address/${clean}`,
    };
  } else if (clean.startsWith("bc1q") || clean.startsWith("bc1p")) {
    return {
      network: "BTC",
      chainName: "Bitcoin Network (SegWit)",
      asset: "Bitcoin (BTC)",
      standard: "Native SegWit (Bech32)",
      confidence: "100%",
      explorerUrl: `https://www.blockchain.com/explorer/addresses/btc/${clean}`,
    };
  } else if (clean.startsWith("1") && clean.length >= 26 && clean.length <= 35) {
    return {
      network: "BTC",
      chainName: "Bitcoin Network (Legacy)",
      asset: "Bitcoin (BTC)",
      standard: "P2PKH Legacy",
      confidence: "100%",
      explorerUrl: `https://www.blockchain.com/explorer/addresses/btc/${clean}`,
    };
  } else if (clean.startsWith("3") && clean.length >= 26 && clean.length <= 35) {
    return {
      network: "BTC",
      chainName: "Bitcoin Network (Multisig)",
      asset: "Bitcoin (BTC)",
      standard: "P2SH Nested SegWit",
      confidence: "100%",
      explorerUrl: `https://www.blockchain.com/explorer/addresses/btc/${clean}`,
    };
  } else if (clean.length >= 32 && clean.length <= 44 && !/[0OIl]/.test(clean)) {
    return {
      network: "SOL",
      chainName: "Solana Mainnet",
      asset: "Solana (SOL) & SPL Tokens",
      standard: "SPL Program",
      confidence: "98%",
      explorerUrl: `https://solscan.io/account/${clean}`,
    };
  }
  return {
    network: "UNKNOWN",
    chainName: "Unknown Ledger",
    asset: "Custom Token",
    standard: "Unspecified",
    confidence: "0%",
    explorerUrl: "#",
  };
}

class EndpointCircuitBreaker {
  private failedHosts = new Map<string, number>();
  private maxCooldownMs = 5000;
  private registeredPools: string[][] = [];

  constructor(maxCooldownMs: number = 5000) {
    this.maxCooldownMs = maxCooldownMs;
  }

  registerPool(hosts: string[]): void {
    this.registeredPools.push(hosts.map(h => this.getHost(h)));
  }

  isAvailable(url: string): boolean {
    const host = this.getHost(url);
    const cooldownUntil = this.failedHosts.get(host);
    if (!cooldownUntil) return true;
    if (Date.now() > cooldownUntil) {
      this.failedHosts.delete(host);
      return true;
    }

    // Resilience rule: Check if all nodes in any registered pool containing this host are locked
    for (const pool of this.registeredPools) {
      if (pool.includes(host)) {
        const allLocked = pool.every(h => {
          const cd = this.failedHosts.get(h);
          return cd && Date.now() <= cd;
        });
        // If all nodes in pool are locked, permit earliest node to prevent total blackout
        if (allLocked) {
          let earliestHost = pool[0];
          let earliestTime = this.failedHosts.get(earliestHost) || Infinity;
          for (const h of pool) {
            const t = this.failedHosts.get(h) || 0;
            if (t < earliestTime) {
              earliestTime = t;
              earliestHost = h;
            }
          }
          if (host === earliestHost) {
            this.failedHosts.delete(host);
            return true;
          }
        }
      }
    }

    return false;
  }

  recordFailure(url: string, durationMs: number = 5000): void {
    const host = this.getHost(url);
    const clamped = Math.min(Math.max(500, durationMs), this.maxCooldownMs);
    this.failedHosts.set(host, Date.now() + clamped);
  }

  recordSuccess(url: string): void {
    const host = this.getHost(url);
    this.failedHosts.delete(host);
  }

  private getHost(url: string): string {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  }
}

export const globalCircuitBreaker = new EndpointCircuitBreaker(5000);

// Pre-register multi-chain endpoint pools for blackout prevention
globalCircuitBreaker.registerPool([
  "https://api.routescan.io",
  "https://eth.blockscout.com",
  "https://ethereum-rpc.publicnode.com",
  "https://eth.llamarpc.com",
  "https://cloudflare-eth.com"
]);
globalCircuitBreaker.registerPool([
  "https://apilist.tronscanapi.com",
  "https://apilist.tronscan.org",
  "https://api.trongrid.io"
]);
globalCircuitBreaker.registerPool([
  "https://blockchain.info",
  "https://blockstream.info",
  "https://mempool.space"
]);

/**
 * Concurrency Limiter to throttle outbound RPC calls and prevent thread starvation
 */
export class ConcurrencyLimiter {
  private activeCount = 0;
  private maxConcurrency: number;
  private queue: Array<() => void> = [];

  constructor(maxConcurrency: number = 8) {
    this.maxConcurrency = maxConcurrency;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.activeCount >= this.maxConcurrency) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.activeCount++;
    try {
      return await task();
    } finally {
      this.activeCount--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        if (next) next();
      }
    }
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}

export const globalRpcLimiter = new ConcurrencyLimiter(8);

/**
 * Safely parses big integers without throwing SyntaxError
 */
export function safeBigInt(val: any, fallback: bigint = 0n): bigint {
  if (val === undefined || val === null || val === "") return fallback;
  try {
    return BigInt(val);
  } catch {
    return fallback;
  }
}

async function safeFetchJson<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 6000
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  if (!globalCircuitBreaker.isAvailable(url)) {
    return { ok: false, status: 429, error: "Host in rate-limit cooldown" };
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AEGIS-TRACE/2.0",
        Accept: "application/json",
        ...(options.headers || {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (res.status === 429) {
      globalCircuitBreaker.recordFailure(url, 3000); // 3s cooldown for real 429
      return { ok: false, status: 429, error: "Rate limit exceeded (429)" };
    }

    if (res.status >= 500) {
      globalCircuitBreaker.recordFailure(url, 2500); // 2.5s cooldown for 5xx
      return { ok: false, status: res.status, error: `Server error (${res.status})` };
    }

    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    }

    globalCircuitBreaker.recordSuccess(url);
    const data = (await res.json()) as T;
    return { ok: true, status: res.status, data };
  } catch (err: any) {
    // Only cooldown for network disconnects, not for client-side Abort/Timeout
    if (err?.name !== "TimeoutError" && err?.name !== "AbortError") {
      globalCircuitBreaker.recordFailure(url, 2000);
    }
    return { ok: false, status: 0, error: err?.message || "Network request failed" };
  }
}

export class MultiChainForensicRouter {
  /**
   * Bitcoin Live Ingestion via resilient multi-endpoint fallback:
   * Tier 1: Blockchain.info rawaddr
   * Tier 2: Blockstream Esplora API
   * Tier 3: Mempool.space API
   */
  async queryBitcoinAccount(address: string): Promise<AccountStateResult> {
    const cacheKey = `btc:${address}`;
    const cached = globalTxCache.get(cacheKey);
    if (cached) return cached;

    const detectedAsset = detectCryptoAsset(address);
    const btcPriceUsd = 88000;
    const outgoing: TransactionRecord[] = [];
    const incoming: TransactionRecord[] = [];
    let balance = 0;
    let totalReceived = 0;
    let totalSent = 0;
    let txCount = 0;
    let querySuccess = false;

    // --- Tier 1: Blockchain.info rawaddr ---
    const bcApiKey = process.env.BLOCKCHAIN_COM_API_KEY;
    const bcHeaders: Record<string, string> = { "User-Agent": "Mozilla/5.0 AEGIS-TRACE/2.0" };
    if (bcApiKey && bcApiKey.length > 5 && !bcApiKey.includes("your_")) {
      bcHeaders["X-API-Token"] = bcApiKey;
    }
    const bcUrl = `https://blockchain.info/rawaddr/${address}?limit=25&cors=true`;
    const bcRes = await safeFetchJson<any>(bcUrl, { headers: bcHeaders }, 3500);

    if (bcRes.ok && bcRes.data) {
      const data = bcRes.data;
      txCount = data.n_tx || 0;
      balance = (data.final_balance || 0) / 1e8;
      totalReceived = (data.total_received || 0) / 1e8;
      totalSent = (data.total_sent || 0) / 1e8;
      querySuccess = true;

      for (const tx of data.txs || []) {
        const txHash = tx.hash || "0x...";
        const timestamp = tx.time ? new Date(tx.time * 1000).toISOString() : new Date().toISOString();
        const blockNumber = tx.block_height || 0;

        const isSender = (tx.inputs || []).some((inp: any) => inp.prev_out?.addr === address);
        if (isSender) {
          for (const out of tx.out || []) {
            if (out.addr && out.addr !== address) {
              const amountBtc = (out.value || 0) / 1e8;
              const amountUsd = Math.round(amountBtc * btcPriceUsd * 100) / 100;
              if (amountUsd > 0) {
                outgoing.push({
                  txHash,
                  fromAddress: address,
                  toAddress: out.addr,
                  amount: amountUsd,
                  tokenSymbol: "BTC",
                  timestamp,
                  blockNumber,
                  network: "BTC",
                });
              }
            }
          }
        } else {
          let recvVal = 0;
          let sender = "External BTC Funding Node";
          if (tx.inputs?.[0]?.prev_out?.addr) sender = tx.inputs[0].prev_out.addr;
          for (const out of tx.out || []) {
            if (out.addr === address) recvVal += (out.value || 0) / 1e8;
          }
          const recvUsd = Math.round(recvVal * btcPriceUsd * 100) / 100;
          if (recvUsd > 0) {
            incoming.push({
              txHash,
              fromAddress: sender,
              toAddress: address,
              amount: recvUsd,
              tokenSymbol: "BTC",
              timestamp,
              blockNumber,
              network: "BTC",
            });
          }
        }
      }
    }

    // --- Tier 2: Blockstream Esplora fallback ---
    if (!querySuccess) {
      const bsStatsUrl = `https://blockstream.info/api/address/${address}`;
      const bsStats = await safeFetchJson<any>(bsStatsUrl, {}, 3000);

      if (bsStats.ok && bsStats.data?.chain_stats) {
        const cs = bsStats.data.chain_stats;
        txCount = cs.tx_count || 0;
        const funded = (cs.funded_txo_sum || 0) / 1e8;
        const spent = (cs.spent_txo_sum || 0) / 1e8;
        balance = Math.max(0, funded - spent);
        totalReceived = funded;
        totalSent = spent;
        querySuccess = true;

        const bsTxsUrl = `https://blockstream.info/api/address/${address}/txs`;
        const bsTxs = await safeFetchJson<any[]>(bsTxsUrl, {}, 3000);
        if (bsTxs.ok && Array.isArray(bsTxs.data)) {
          for (const tx of bsTxs.data.slice(0, 25)) {
            const txHash = tx.txid || "0x...";
            const timestamp = tx.status?.block_time
              ? new Date(tx.status.block_time * 1000).toISOString()
              : new Date().toISOString();
            const blockNumber = tx.status?.block_height || 0;

            const isSender = (tx.vin || []).some(
              (inp: any) => inp.prevout?.scriptpubkey_address === address
            );
            if (isSender) {
              for (const out of tx.vout || []) {
                const outAddr = out.scriptpubkey_address;
                if (outAddr && outAddr !== address) {
                  const amountBtc = (out.value || 0) / 1e8;
                  const amountUsd = Math.round(amountBtc * btcPriceUsd * 100) / 100;
                  if (amountUsd > 0) {
                    outgoing.push({
                      txHash,
                      fromAddress: address,
                      toAddress: outAddr,
                      amount: amountUsd,
                      tokenSymbol: "BTC",
                      timestamp,
                      blockNumber,
                      network: "BTC",
                    });
                  }
                }
              }
            } else {
              const sender = tx.vin?.[0]?.prevout?.scriptpubkey_address || "External BTC Node";
              for (const out of tx.vout || []) {
                if (out.scriptpubkey_address === address) {
                  const valUsd = Math.round(((out.value || 0) / 1e8) * btcPriceUsd * 100) / 100;
                  if (valUsd > 0) {
                    incoming.push({
                      txHash,
                      fromAddress: sender,
                      toAddress: address,
                      amount: valUsd,
                      tokenSymbol: "BTC",
                      timestamp,
                      blockNumber,
                      network: "BTC",
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    // --- Tier 3: Mempool.space fallback ---
    if (!querySuccess) {
      const mpStatsUrl = `https://mempool.space/api/address/${address}`;
      const mpStats = await safeFetchJson<any>(mpStatsUrl, {}, 3000);
      if (mpStats.ok && mpStats.data?.chain_stats) {
        const cs = mpStats.data.chain_stats;
        txCount = cs.tx_count || 0;
        const funded = (cs.funded_txo_sum || 0) / 1e8;
        const spent = (cs.spent_txo_sum || 0) / 1e8;
        balance = Math.max(0, funded - spent);
        totalReceived = funded;
        totalSent = spent;
        querySuccess = true;

        const mpTxsUrl = `https://mempool.space/api/address/${address}/txs`;
        const mpTxs = await safeFetchJson<any[]>(mpTxsUrl, {}, 3000);
        if (mpTxs.ok && Array.isArray(mpTxs.data)) {
          for (const tx of mpTxs.data.slice(0, 25)) {
            const txHash = tx.txid || "0x...";
            const timestamp = tx.status?.block_time
              ? new Date(tx.status.block_time * 1000).toISOString()
              : new Date().toISOString();
            const blockNumber = tx.status?.block_height || 0;

            const isSender = (tx.vin || []).some(
              (inp: any) => inp.prevout?.scriptpubkey_address === address
            );
            if (isSender) {
              for (const out of tx.vout || []) {
                const outAddr = out.scriptpubkey_address;
                if (outAddr && outAddr !== address) {
                  const amountBtc = (out.value || 0) / 1e8;
                  const amountUsd = Math.round(amountBtc * btcPriceUsd * 100) / 100;
                  if (amountUsd > 0) {
                    outgoing.push({
                      txHash,
                      fromAddress: address,
                      toAddress: outAddr,
                      amount: amountUsd,
                      tokenSymbol: "BTC",
                      timestamp,
                      blockNumber,
                      network: "BTC",
                    });
                  }
                }
              }
            } else {
              const sender = tx.vin?.[0]?.prevout?.scriptpubkey_address || "External BTC Node";
              for (const out of tx.vout || []) {
                if (out.scriptpubkey_address === address) {
                  const valUsd = Math.round(((out.value || 0) / 1e8) * btcPriceUsd * 100) / 100;
                  if (valUsd > 0) {
                    incoming.push({
                      txHash,
                      fromAddress: sender,
                      toAddress: address,
                      amount: valUsd,
                      tokenSymbol: "BTC",
                      timestamp,
                      blockNumber,
                      network: "BTC",
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    outgoing.sort((a, b) => b.amount - a.amount);

    const result: AccountStateResult = {
      address,
      network: "BTC",
      detectedAsset,
      balance,
      balanceUsd: Math.round(balance * btcPriceUsd * 100) / 100,
      totalReceived: Math.round(totalReceived * btcPriceUsd * 100) / 100,
      totalSent: Math.round(totalSent * btcPriceUsd * 100) / 100,
      txCount,
      outgoingTransfers: outgoing.slice(0, 10),
      incomingTransfers: incoming.slice(0, 10),
    };

    globalTxCache.set(cacheKey, result);
    return result;
  }

  /**
   * TRON Live Ingestion via resilient multi-endpoint fallback:
   * Tier 1: TronScan TRC-20 transfers
   * Tier 2: TronGrid official REST API
   * Tier 3: TronScan alternative transaction endpoint
   */
  async queryTronAccount(address: string): Promise<AccountStateResult> {
    const cacheKey = `tron:${address}`;
    const cached = globalTxCache.get(cacheKey);
    if (cached) return cached;

    const detectedAsset = detectCryptoAsset(address);
    const outgoing: TransactionRecord[] = [];
    const incoming: TransactionRecord[] = [];
    let totalInflow = 0;
    let totalOutflow = 0;
    let querySuccess = false;

    // --- Tier 1: TronScan TRC-20 transfers ---
    const tgApiKey = process.env.TRONGRID_API_KEY;
    const tgHeaders: Record<string, string> = { "User-Agent": "Mozilla/5.0 AEGIS-TRACE/2.0" };
    if (tgApiKey && tgApiKey.length > 5 && !tgApiKey.includes("your_")) {
      tgHeaders["TRON-PRO-API-KEY"] = tgApiKey;
    }

    const tsUrl = `https://apilist.tronscanapi.com/api/token_trc20/transfers?limit=25&start=0&relatedAddress=${address}`;
    let tsRes = await safeFetchJson<any>(tsUrl, { headers: tgHeaders }, 3500);
    if (!tsRes.ok) {
      tsRes = await safeFetchJson<any>(`https://apilist.tronscan.org/api/token_trc20/transfers?limit=25&start=0&relatedAddress=${address}`, { headers: tgHeaders }, 3500);
    }

    if (tsRes.ok && tsRes.data?.token_transfers) {
      querySuccess = true;
      for (const t of tsRes.data.token_transfers || []) {
        const fromAddr = t.from_address || "";
        const toAddr = t.to_address || "";
        const rawAmount = Number(t.quant || 0);
        const decimals = Number(t.tokenInfo?.tokenDecimal ?? 6);
        const val = decimals > 0 ? rawAmount / Math.pow(10, decimals) : rawAmount;
        const valUsd = Math.round(val * 100) / 100;
        const timestamp = t.block_ts ? new Date(t.block_ts).toISOString() : new Date().toISOString();
        const blockNumber = t.block || 0;
        const txHash = t.transaction_id || "0x...";

        if (valUsd <= 0) continue;

        if (fromAddr.toLowerCase() === address.toLowerCase()) {
          totalOutflow += valUsd;
          outgoing.push({
            txHash,
            fromAddress: address,
            toAddress: toAddr,
            amount: valUsd,
            tokenSymbol: "USDT",
            timestamp,
            blockNumber,
            network: "TRON",
          });
        } else {
          totalInflow += valUsd;
          incoming.push({
            txHash,
            fromAddress: fromAddr,
            toAddress: address,
            amount: valUsd,
            tokenSymbol: "USDT",
            timestamp,
            blockNumber,
            network: "TRON",
          });
        }
      }
    }

    // --- Tier 2: TronGrid official REST API fallback ---
    if (!querySuccess || (outgoing.length === 0 && incoming.length === 0)) {
      const tgUrl = `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20?limit=25`;
      const tgRes = await safeFetchJson<any>(tgUrl, { headers: tgHeaders }, 3500);

      if (tgRes.ok && Array.isArray(tgRes.data?.data)) {
        querySuccess = true;
        for (const t of tgRes.data.data) {
          const fromAddr = t.from || "";
          const toAddr = t.to || "";
          const rawVal = Number(t.value || 0);
          const decimals = Number(t.token_info?.decimals ?? 6);
          const val = decimals > 0 ? rawVal / Math.pow(10, decimals) : rawVal;
          const valUsd = Math.round(val * 100) / 100;
          const timestamp = t.block_timestamp
            ? new Date(t.block_timestamp).toISOString()
            : new Date().toISOString();
          const txHash = t.transaction_id || "0x...";
          const symbol = (t.token_info?.symbol || "USDT").toUpperCase();

          if (valUsd <= 0) continue;

          if (fromAddr.toLowerCase() === address.toLowerCase()) {
            totalOutflow += valUsd;
            outgoing.push({
              txHash,
              fromAddress: address,
              toAddress: toAddr,
              amount: valUsd,
              tokenSymbol: symbol,
              timestamp,
              blockNumber: 0,
              network: "TRON",
            });
          } else {
            totalInflow += valUsd;
            incoming.push({
              txHash,
              fromAddress: fromAddr,
              toAddress: address,
              amount: valUsd,
              tokenSymbol: symbol,
              timestamp,
              blockNumber: 0,
              network: "TRON",
            });
          }
        }
      }
    }

    // --- Tier 3: TronScan native transaction endpoint fallback ---
    if (outgoing.length === 0 && incoming.length === 0) {
      const tsTxUrl = `https://apilist.tronscanapi.com/api/transaction?sort=-timestamp&count=true&limit=25&start=0&address=${address}`;
      let tsTxRes = await safeFetchJson<any>(tsTxUrl, { headers: tgHeaders }, 3500);
      if (!tsTxRes.ok) {
        tsTxRes = await safeFetchJson<any>(
          `https://apilist.tronscan.org/api/transaction?sort=-timestamp&count=true&limit=25&start=0&address=${address}`,
          { headers: tgHeaders },
          3500
        );
      }
      if (tsTxRes.ok && Array.isArray(tsTxRes.data?.data)) {
        for (const t of tsTxRes.data.data) {
          const ownerAddr = t.ownerAddress || t.contractData?.owner_address || "";
          const destAddr =
            t.toAddress ||
            t.contractData?.receiver_address ||
            t.contractData?.to_address ||
            t.trigger_info?.parameter?._to ||
            "";
          const txHash = t.hash || t.transaction_id || "0x...";
          const timestamp = t.timestamp ? new Date(t.timestamp).toISOString() : new Date().toISOString();
          const blockNumber = t.block || 0;

          let valUsd = 0;
          let symbol = "TRX";

          if (t.trigger_info?.parameter?._value && t.trigger_info?.parameter?._to) {
            const rawVal = Number(t.trigger_info.parameter._value || 0);
            valUsd = Math.round((rawVal / 1e6) * 100) / 100;
            symbol = "USDT";
          } else {
            const sunAmount = Number(t.contractData?.amount || t.contractData?.balance || t.amount || 0);
            if (sunAmount > 0) {
              const trxAmount = sunAmount / 1e6;
              valUsd = Math.round(trxAmount * 0.25 * 100) / 100;
              symbol = "TRX";
            }
          }

          if (valUsd <= 0 || !destAddr) continue;

          if (ownerAddr.toLowerCase() === address.toLowerCase()) {
            totalOutflow += valUsd;
            outgoing.push({
              txHash,
              fromAddress: address,
              toAddress: destAddr,
              amount: valUsd,
              tokenSymbol: symbol,
              timestamp,
              blockNumber,
              network: "TRON",
            });
          } else if (destAddr.toLowerCase() === address.toLowerCase()) {
            totalInflow += valUsd;
            incoming.push({
              txHash,
              fromAddress: ownerAddr || "External TRON Sender",
              toAddress: address,
              amount: valUsd,
              tokenSymbol: symbol,
              timestamp,
              blockNumber,
              network: "TRON",
            });
          }
        }
      }
    }

    // Sort outgoing by amount descending
    outgoing.sort((a, b) => b.amount - a.amount);

    let finalBalanceUsd = Math.max(0, Math.round((totalInflow - totalOutflow) * 100) / 100);
    let finalTxCount = outgoing.length + incoming.length;

    if (finalBalanceUsd === 0 || finalTxCount === 0) {
      try {
        const accRes = await safeFetchJson<any>(
          `https://apilist.tronscanapi.com/api/account?address=${address}`,
          { headers: tgHeaders },
          3500
        );
        if (accRes.ok && accRes.data) {
          const sunBal = Number(accRes.data.balance || 0);
          const trxBal = sunBal / 1e6;
          const trxUsd = Math.round(trxBal * 0.25 * 100) / 100;
          if (trxUsd > 0) finalBalanceUsd = trxUsd;
          if (accRes.data.totalTransactionCount) {
            finalTxCount = Math.max(finalTxCount, Number(accRes.data.totalTransactionCount));
          }
        }
      } catch {}
    }

    const result: AccountStateResult = {
      address,
      network: "TRON",
      detectedAsset,
      balance: finalBalanceUsd,
      balanceUsd: finalBalanceUsd,
      totalReceived: Math.round(totalInflow * 100) / 100,
      totalSent: Math.round(totalOutflow * 100) / 100,
      txCount: finalTxCount,
      outgoingTransfers: outgoing.slice(0, 10),
      incomingTransfers: incoming.slice(0, 10),
    };

    globalTxCache.set(cacheKey, result);
    return result;
  }

  /**
   * EVM Live Ingestion via resilient multi-endpoint fallback:
   * Tier 1: Blockscout v2 REST (token transfers, native txs, balance)
   * Tier 2: Public JSON-RPC nodes (eth_getBalance, eth_getTransactionCount)
   */
  async queryEvmAccount(
    address: string,
    network: "ETH" | "POLYGON" | "BASE" | "BSC" | "ARBITRUM" = "ETH"
  ): Promise<AccountStateResult> {
    const clean = address.toLowerCase();
    const cacheKey = `evm:${network}:${clean}`;
    const cached = globalTxCache.get(cacheKey);
    if (cached) return cached;

    const detectedAsset = detectCryptoAsset(address);
    const hostMap: Record<string, string> = {
      POLYGON: "polygon.blockscout.com",
      BSC: "bsc.blockscout.com",
      BASE: "base.blockscout.com",
      ARBITRUM: "arbitrum.blockscout.com",
      ETH: "eth.blockscout.com",
    };
    const host = hostMap[network] || "eth.blockscout.com";

    const outgoing: TransactionRecord[] = [];
    const incoming: TransactionRecord[] = [];
    let balanceUsd = 0;
    let totalInflow = 0;
    let totalOutflow = 0;
    let blockscoutSuccess = false;

    // --- Tier 1: Multi-chain EVM token transfers & native transactions in parallel ---
    let tokenRes: any = null;
    let txRes: any = null;
    let internalRes: any = null;
    let balRes: any = null;

    if (network === "ETH") {
      // Primary for Ethereum: RouteScan high-performance EVM mirror (no rate limits, sort=desc for recent blocks)
      const rsTokenUrl = `https://api.routescan.io/v2/network/mainnet/evm/1/etherscan/api?module=account&action=tokentx&address=${clean}&page=1&offset=25&sort=desc`;
      const rsTxUrl = `https://api.routescan.io/v2/network/mainnet/evm/1/etherscan/api?module=account&action=txlist&address=${clean}&page=1&offset=25&sort=desc`;
      const rsInternalUrl = `https://api.routescan.io/v2/network/mainnet/evm/1/etherscan/api?module=account&action=txlistinternal&address=${clean}&page=1&offset=25&sort=desc`;
      const rsBalUrl = `https://api.routescan.io/v2/network/mainnet/evm/1/etherscan/api?module=account&action=balance&address=${clean}`;

      const [rToken, rTx, rInternal, rBal] = await Promise.all([
        safeFetchJson<any>(rsTokenUrl, {}, 5000),
        safeFetchJson<any>(rsTxUrl, {}, 5000),
        safeFetchJson<any>(rsInternalUrl, {}, 5000),
        safeFetchJson<any>(rsBalUrl, {}, 4000),
      ]);

      tokenRes = rToken;
      txRes = rTx;
      internalRes = rInternal;
      balRes = rBal;

      // Fallback to Blockscout if RouteScan returned non-ok or empty results
      if (!tokenRes?.ok || !Array.isArray(tokenRes?.data?.result) || tokenRes.data.result.length === 0) {
        const bsTokenUrl = `https://eth.blockscout.com/api?module=account&action=tokentx&address=${clean}&page=1&offset=25&sort=desc`;
        const bsRes = await safeFetchJson<any>(bsTokenUrl, {}, 4500);
        if (bsRes.ok && Array.isArray(bsRes.data?.result) && bsRes.data.result.length > 0) {
          tokenRes = bsRes;
        }
      }
      if (!txRes?.ok || !Array.isArray(txRes?.data?.result) || txRes.data.result.length === 0) {
        const bsTxUrl = `https://eth.blockscout.com/api?module=account&action=txlist&address=${clean}&page=1&offset=25&sort=desc`;
        const bsRes = await safeFetchJson<any>(bsTxUrl, {}, 4500);
        if (bsRes.ok && Array.isArray(bsRes.data?.result) && bsRes.data.result.length > 0) {
          txRes = bsRes;
        }
      }
      if (!balRes?.ok || !balRes?.data?.result || balRes.data.result === "0") {
        const bsBalUrl = `https://eth.blockscout.com/api?module=account&action=balance&address=${clean}`;
        const bsRes = await safeFetchJson<any>(bsBalUrl, {}, 3500);
        if (bsRes.ok && bsRes.data?.result) {
          balRes = bsRes;
        }
      }
    } else {
      // Non-ETH EVM networks (Polygon, Base, Arbitrum, BSC) via Blockscout with sort=desc
      const tokenUrl = `https://${host}/api?module=account&action=tokentx&address=${clean}&page=1&offset=25&sort=desc`;
      const txUrl = `https://${host}/api?module=account&action=txlist&address=${clean}&page=1&offset=25&sort=desc`;
      const balUrl = `https://${host}/api?module=account&action=balance&address=${clean}`;

      const [rToken, rTx, rBal] = await Promise.all([
        safeFetchJson<any>(tokenUrl, {}, 3500),
        safeFetchJson<any>(txUrl, {}, 3500),
        safeFetchJson<any>(balUrl, {}, 3000),
      ]);
      tokenRes = rToken;
      txRes = rTx;
      balRes = rBal;
    }

    if (tokenRes?.ok && Array.isArray(tokenRes?.data?.result)) {
      blockscoutSuccess = true;
      for (const item of tokenRes.data.result) {
        const fromAddr = (item.from || "").toLowerCase();
        const toAddr = (item.to || "").toLowerCase();
        const rawValStr = item.value || "0";
        let rawVal = BigInt(0);
        try { rawVal = BigInt(rawValStr); } catch {}

        const dec = Number(item.tokenDecimal || 18);
        const tokenUnits = Number(rawVal) / Math.pow(10, Math.max(0, Math.min(18, dec)));
        const symbol = (item.tokenSymbol || "USDT").toUpperCase();
        const timestamp = item.timeStamp 
          ? new Date(Number(item.timeStamp) * 1000).toISOString() 
          : new Date().toISOString();
        const blockNumber = Number(item.blockNumber || 0);
        const txHash = item.hash || "0x...";

        let rate = 1.0;
        const isStable = ["USDT", "USDC", "DAI", "BUSD", "FDUSD", "TUSD", "PYUSD", "USDE"].includes(symbol);
        const isEthAsset = ["WETH", "ETH", "STETH", "RETH"].includes(symbol);
        const isBtcAsset = ["WBTC", "BTCB"].includes(symbol);

        if (isStable) {
          rate = 1.0;
        } else if (isEthAsset) {
          rate = 2700.0;
        } else if (isBtcAsset) {
          rate = 88000.0;
        } else {
          // Unverified or meme tokens capped at nominal rate so they do not artificially distort volume
          rate = 0.05;
        }

        const valUsd = Math.round(tokenUnits * rate * 100) / 100;
        if (valUsd < 1) continue;

        if (fromAddr === clean && toAddr && toAddr !== clean) {
          totalOutflow += valUsd;
          outgoing.push({
            txHash,
            fromAddress: clean,
            toAddress: toAddr,
            amount: valUsd,
            tokenSymbol: symbol,
            timestamp,
            blockNumber,
            network,
          });
        } else if (toAddr === clean && fromAddr && fromAddr !== clean) {
          totalInflow += valUsd;
          incoming.push({
            txHash,
            fromAddress: fromAddr,
            toAddress: clean,
            amount: valUsd,
            tokenSymbol: symbol,
            timestamp,
            blockNumber,
            network,
          });
        }
      }
    }

    // Native ETH transactions via txlist
    if (txRes?.ok && Array.isArray(txRes?.data?.result)) {
      blockscoutSuccess = true;
      const ethPrice = 2700;
      for (const item of txRes.data.result) {
        const fromAddr = (item.from || "").toLowerCase();
        const toAddr = (item.to || "").toLowerCase();
        let valEth = 0;
        try {
          valEth = Number(BigInt(item.value || "0")) / 1e18;
        } catch {}
        const valUsd = Math.round(valEth * ethPrice * 100) / 100;
        const timestamp = item.timeStamp 
          ? new Date(Number(item.timeStamp) * 1000).toISOString() 
          : new Date().toISOString();
        const blockNumber = Number(item.blockNumber || 0);
        const txHash = item.hash || "0x...";

        if (valUsd < 5) continue;

        if (fromAddr === clean && toAddr && toAddr !== clean) {
          totalOutflow += valUsd;
          outgoing.push({
            txHash,
            fromAddress: clean,
            toAddress: toAddr,
            amount: valUsd,
            tokenSymbol: "ETH",
            timestamp,
            blockNumber,
            network,
          });
        } else if (toAddr === clean && fromAddr && fromAddr !== clean) {
          totalInflow += valUsd;
          incoming.push({
            txHash,
            fromAddress: fromAddr,
            toAddress: clean,
            amount: valUsd,
            tokenSymbol: "ETH",
            timestamp,
            blockNumber,
            network,
          });
        }
      }
    }

    // Internal transactions via txlistinternal (smart contracts, DEX swaps, mixer withdrawals)
    if (internalRes?.ok && Array.isArray(internalRes?.data?.result)) {
      blockscoutSuccess = true;
      const ethPrice = 2700;
      for (const item of internalRes.data.result) {
        if (item.isError === "1") continue;
        const fromAddr = (item.from || "").toLowerCase();
        const toAddr = (item.to || "").toLowerCase();
        let valEth = 0;
        try {
          valEth = Number(BigInt(item.value || "0")) / 1e18;
        } catch {}
        const valUsd = Math.round(valEth * ethPrice * 100) / 100;
        const timestamp = item.timeStamp
          ? new Date(Number(item.timeStamp) * 1000).toISOString()
          : new Date().toISOString();
        const blockNumber = Number(item.blockNumber || 0);
        const txHash = item.hash || "0x...";

        if (valUsd < 5) continue;

        if (outgoing.some((o) => o.txHash === txHash) || incoming.some((i) => i.txHash === txHash)) continue;

        if (fromAddr === clean && toAddr && toAddr !== clean) {
          totalOutflow += valUsd;
          outgoing.push({
            txHash,
            fromAddress: clean,
            toAddress: toAddr,
            amount: valUsd,
            tokenSymbol: "ETH",
            timestamp,
            blockNumber,
            network,
          });
        } else if (toAddr === clean && fromAddr && fromAddr !== clean) {
          totalInflow += valUsd;
          incoming.push({
            txHash,
            fromAddress: fromAddr,
            toAddress: clean,
            amount: valUsd,
            tokenSymbol: "ETH",
            timestamp,
            blockNumber,
            network,
          });
        }
      }
    }

    // Address balance via balance action
    if (balRes?.ok && balRes?.data?.result) {
      let ethBal = 0;
      try {
        ethBal = Number(BigInt(balRes.data.result || "0")) / 1e18;
      } catch {}
      balanceUsd = Math.round(ethBal * 2700 * 100) / 100;
    }

    // --- Tier 2: Public JSON-RPC nodes fallback if Blockscout failed or rate-limited ---
    if (!blockscoutSuccess) {
      const rpcPools: Record<string, string[]> = {
        ETH: ["https://eth.llamarpc.com", "https://rpc.ankr.com/eth", "https://cloudflare-eth.com"],
        POLYGON: ["https://polygon-rpc.com", "https://rpc.ankr.com/polygon"],
        BSC: ["https://binance.llamarpc.com", "https://bsc-dataseed.binance.org"],
        BASE: ["https://mainnet.base.org", "https://base.llamarpc.com"],
        ARBITRUM: ["https://arb1.arbitrum.io/rpc"],
      };

      const endpoints = rpcPools[network] || rpcPools.ETH;
      for (const rpcUrl of endpoints) {
        const rpcPayload = JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getBalance",
          params: [clean, "latest"],
        });

        const rpcRes = await safeFetchJson<any>(
          rpcUrl,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: rpcPayload,
          },
          2500
        );

        if (rpcRes.ok && rpcRes.data?.result) {
          const rawHex = rpcRes.data.result;
          const wei = BigInt(rawHex);
          const eth = Number(wei) / 1e18;
          balanceUsd = Math.round(eth * 2700 * 100) / 100;
          break;
        }
      }
    }

    outgoing.sort((a, b) => b.amount - a.amount);

    const result: AccountStateResult = {
      address: clean,
      network,
      detectedAsset,
      balance: balanceUsd,
      balanceUsd,
      totalReceived: Math.round(totalInflow * 100) / 100,
      totalSent: Math.round(totalOutflow * 100) / 100,
      txCount: outgoing.length + incoming.length,
      outgoingTransfers: outgoing.slice(0, 10),
      incomingTransfers: incoming.slice(0, 10),
    };

    globalTxCache.set(cacheKey, result);
    return result;
  }

  /**
   * Solana Live Ingestion via public JSON-RPC nodes
   */
  async querySolanaAccount(address: string): Promise<AccountStateResult> {
    const cacheKey = `sol:${address}`;
    const cached = globalTxCache.get(cacheKey);
    if (cached) return cached;

    const detectedAsset = detectCryptoAsset(address);
    const solPriceUsd = 185;
    let balanceSol = 0;
    const outgoing: TransactionRecord[] = [];
    const incoming: TransactionRecord[] = [];

    const solEndpoints = [
      "https://api.mainnet-beta.solana.com",
      "https://rpc.ankr.com/solana",
    ];

    for (const rpcUrl of solEndpoints) {
      const payload = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [address],
      });

      const res = await safeFetchJson<any>(
        rpcUrl,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
        },
        2500
      );

      if (res.ok && res.data?.result?.value !== undefined) {
        const lamports = Number(res.data.result.value);
        balanceSol = lamports / 1e9;
        break;
      }
    }

    const balanceUsd = Math.round(balanceSol * solPriceUsd * 100) / 100;

    const result: AccountStateResult = {
      address,
      network: "SOL",
      detectedAsset,
      balance: balanceSol,
      balanceUsd,
      totalReceived: balanceUsd,
      totalSent: 0,
      txCount: 0,
      outgoingTransfers: outgoing,
      incomingTransfers: incoming,
    };

    globalTxCache.set(cacheKey, result);
    return result;
  }

  async queryAccount(address: string, network?: BlockchainNetwork): Promise<AccountStateResult> {
    const net = network && network !== "UNKNOWN" ? network : detectCryptoAsset(address).network;
    if (net === "BTC") return await this.queryBitcoinAccount(address);
    if (net === "TRON") return await this.queryTronAccount(address);
    if (net === "SOL") return await this.querySolanaAccount(address);
    const evmNet =
      net === "POLYGON" || net === "BSC" || net === "BASE" || net === "ARBITRUM" ? net : "ETH";
    return await this.queryEvmAccount(address, evmNet);
  }
}

export const globalMultiChainRouter = new MultiChainForensicRouter();
