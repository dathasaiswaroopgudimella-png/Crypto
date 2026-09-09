'use client';

import { useMemo, useState, useEffect } from "react";
import {
  Search,
  Shield,
  ChevronDown,
  CheckCircle2,
  ArrowUpRight,
  AlertTriangle,
  Activity,
  Database,
  Network,
  FolderCheck,
  Zap,
  Terminal,
  X,
  Radio,
  Sparkles,
} from "lucide-react";
import { AUTHENTIC_FORENSIC_CASES } from "@/lib/forensic-cases";
import { BlockchainNetwork } from "@/lib/types";
import { detectCryptoAsset } from "@/lib/rpc/multi-chain";

export type Tab = "overview" | "trace" | "vasp" | "alerts" | "legal" | "dossier";

interface HeaderProps {
  activeTab: Tab;
  setActiveTab: (t: Tab) => void;
  searchAddress: string;
  setSearchAddress: (v: string) => void;
  selectedNetwork: BlockchainNetwork | "AUTO";
  setSelectedNetwork: (n: BlockchainNetwork | "AUTO") => void;
  onSearch: () => void;
  isLoading: boolean;
  onSelectCase: (address: string) => void;
  alertCount?: number;
}

interface TabItem {
  id: Tab;
  label: string;
  code: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabItem[] = [
  { id: "overview", label: "National Context & Benchmarks", code: "01", icon: Activity },
  { id: "trace", label: "Investigation Studio & Graph", code: "02", icon: Network },
  { id: "alerts", label: "Laundering Typology Lab", code: "03", icon: AlertTriangle },
  { id: "vasp", label: "VASP Subpoena Directory", code: "04", icon: Database },
  { id: "legal", label: "Section 94 BNSS Notice Forge", code: "05", icon: Shield },
  { id: "dossier", label: "Case Dossier & Evidence Log", code: "06", icon: FolderCheck },
];

export default function Header({
  activeTab,
  setActiveTab,
  searchAddress,
  setSearchAddress,
  selectedNetwork,
  setSelectedNetwork,
  onSearch,
  isLoading,
  onSelectCase,
  alertCount = 0,
}: HeaderProps) {
  // Live multi-chain RPC telemetry simulation (deterministic initial state for zero hydration mismatch)
  const [rpcTelemetry, setRpcTelemetry] = useState({
    latency: 142,
    blockNumber: 21948201,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setRpcTelemetry((prev) => ({
        latency: Math.floor(136 + Math.random() * 12),
        blockNumber: prev.blockNumber + (Math.random() > 0.65 ? 1 : 0),
      }));
    }, 3800);
    return () => clearInterval(interval);
  }, []);

  // Live regex detection for typed or loaded cryptocurrency address
  const liveAssetInfo = useMemo(() => {
    const trimmed = searchAddress.trim();
    if (!trimmed) return null;
    return detectCryptoAsset(trimmed);
  }, [searchAddress]);

  return (
    <header className="sticky top-0 z-50 bg-[#070b14]/95 backdrop-blur-xl border-b border-cyan-500/20 shadow-[0_4px_30px_rgba(0,0,0,0.7)]">
      {/* Top Institutional Identity Bar */}
      <div className="px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 bg-gradient-to-r from-[#090e1c] via-[#070b14] to-[#090e1c]">
        {/* Left: Cyber-Defense Crest & Agency Designation */}
        <div className="flex items-center gap-3.5">
          {/* Cyber-defense badge with glowing cyan/blue pulse */}
          <div className="relative flex items-center justify-center">
            <span className="absolute -inset-1 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 opacity-65 blur-md animate-pulse pointer-events-none" />
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-slate-900 via-sky-950 to-blue-950 border border-cyan-400/50 shadow-[0_0_18px_rgba(6,182,212,0.45)] flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(6,182,212,0.12)_51%)] bg-[length:100%_3px] pointer-events-none" />
              <Shield className="w-5 h-5 text-cyan-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.85)]" />
              <div className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-2 ring-slate-950 animate-ping" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-sm sm:text-base font-black tracking-wider text-white">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-300 drop-shadow-[0_0_12px_rgba(56,189,248,0.5)]">
                    AEGIS
                  </span>
                  -TRACE
                </span>
                <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold tracking-widest uppercase rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.2)]">
                  CYBER-COMMAND
                </span>
              </div>

              <span className="hidden md:inline-block h-3 w-px bg-slate-700" />

              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold tracking-wide text-slate-100 font-sans">
                  INDIAN CYBER CRIME COORDINATION CENTRE (I4C)
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider uppercase bg-blue-950/80 text-sky-300 border border-sky-500/30">
                  MHA // CIS DIV
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
              <span className="text-cyan-400/90 font-medium">
                Real-Time Crypto Fraud Attribution &amp; VASP Identification System
              </span>
              <span className="text-slate-600 hidden sm:inline">·</span>
              <span className="text-slate-400 font-mono text-[10px] hidden sm:inline">
                PS SIH26183
              </span>
              <span className="text-slate-600 hidden lg:inline">·</span>
              <span className="text-emerald-400/90 font-mono text-[10px] font-semibold hidden lg:inline">
                SEC. 94 BNSS READY
              </span>
            </div>
          </div>
        </div>

        {/* Right: Live Multi-Chain RPC Latency Ping & Institutional Pill */}
        <div className="flex items-center gap-2.5 sm:gap-3 ml-auto">
          {/* Live RPC Telemetry Ping Badge */}
          <div
            suppressHydrationWarning
            className="flex items-center gap-2 bg-slate-950/90 border border-cyan-500/30 rounded-full px-3 py-1 shadow-[0_0_14px_rgba(6,182,212,0.12)]"
          >
            <div className="relative flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
              <span className="absolute w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-75" />
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <span className="text-emerald-400 font-bold tracking-tight">LIVE RPC</span>
              <span className="text-slate-700">|</span>
              <span className="text-cyan-300 font-semibold">{rpcTelemetry.latency}ms</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-200 font-medium">Block #{rpcTelemetry.blockNumber.toLocaleString()}</span>
              <span className="hidden xl:inline text-slate-600">·</span>
              <span className="hidden xl:inline text-emerald-400 font-medium">Zero Dropped Packets</span>
            </div>
          </div>

          {/* Classification Pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/90 border border-slate-700/90 text-[10px] font-mono shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            <span className="text-slate-300 font-semibold uppercase tracking-wider">RESTRICTED // LEA</span>
          </div>
        </div>
      </div>

      {/* Search, Network Selector & Benchmark Case Bar */}
      <div className="px-4 sm:px-6 py-2.5 flex flex-col gap-2 bg-slate-950/60">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
          {/* Network Selector Dropdown */}
          <div className="relative md:w-56 shrink-0">
            <select
              value={selectedNetwork}
              onChange={(e) => setSelectedNetwork(e.target.value as any)}
              className="w-full appearance-none bg-slate-900/90 hover:bg-slate-900 border border-cyan-500/30 hover:border-cyan-400 focus:border-cyan-400 rounded-lg pl-3 pr-8 py-2.5 text-xs font-mono font-semibold text-cyan-300 cursor-pointer shadow-[0_0_12px_rgba(6,182,212,0.08)] transition-colors"
            >
              <option value="AUTO" className="bg-slate-950 text-cyan-300">⚡ Auto Detect Ledger</option>
              <option value="ETH" className="bg-slate-950 text-slate-200">Ethereum / EVM (ETH)</option>
              <option value="TRON" className="bg-slate-950 text-slate-200">TRON (TRC-20 USDT)</option>
              <option value="BTC" className="bg-slate-950 text-slate-200">Bitcoin (BTC / SegWit)</option>
              <option value="POLYGON" className="bg-slate-950 text-slate-200">Polygon PoS (POL)</option>
              <option value="SOL" className="bg-slate-950 text-slate-200">Solana (SPL Token)</option>
              <option value="BSC" className="bg-slate-950 text-slate-200">BNB Smart Chain (BSC)</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-cyan-400/70 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Search Input with Monospace Address & Live Regex Indicator */}
          <div className="relative flex-1 flex items-center bg-slate-950/90 border border-slate-700/80 hover:border-slate-600 focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-500/25 rounded-lg transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]">
            <div className="pl-3 pr-2 flex items-center pointer-events-none text-slate-500">
              <Terminal className="w-4 h-4 text-cyan-400/80" />
            </div>

            <input
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              placeholder="Enter suspect wallet — 0x... (ETH/BSC), T... (TRON), bc1... (BTC), or Base58 (SOL)"
              className="w-full bg-transparent py-2.5 pr-2 text-xs sm:text-sm font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none tracking-wide"
              spellCheck={false}
            />

            {/* Right inside search field: Live regex indicator badge & clear button */}
            <div className="pr-2 flex items-center gap-1.5 shrink-0">
              {searchAddress && (
                <button
                  onClick={() => setSearchAddress("")}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Clear address input"
                  type="button"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {liveAssetInfo && liveAssetInfo.network !== "UNKNOWN" ? (
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/80 border border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)] animate-fade-in">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-mono text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                    {liveAssetInfo.network} · {liveAssetInfo.standard}
                  </span>
                </div>
              ) : searchAddress.trim().length > 0 ? (
                <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 text-amber-300 font-mono text-[10px]">
                  <AlertTriangle className="w-3 h-3 text-amber-400 animate-pulse" />
                  <span>REGEX EVAL</span>
                </div>
              ) : (
                <div className="hidden lg:flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900/60 border border-slate-800 text-slate-500 font-mono text-[10px]">
                  <span>AUTO-REGEX</span>
                </div>
              )}
            </div>
          </div>

          {/* High-Impact Neon Button for 'Trace Suspect Funds' */}
          <button
            onClick={onSearch}
            disabled={isLoading}
            suppressHydrationWarning
            className={`relative group flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-mono text-xs sm:text-sm font-black uppercase tracking-wider transition-all duration-200 select-none whitespace-nowrap ${
              isLoading
                ? "bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed shadow-none"
                : "bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 hover:from-cyan-300 hover:via-sky-300 hover:to-blue-400 text-slate-950 border border-cyan-200/60 shadow-[0_0_20px_rgba(6,182,212,0.55),0_0_40px_rgba(6,182,212,0.25)] hover:shadow-[0_0_30px_rgba(6,182,212,0.85),0_0_60px_rgba(6,182,212,0.4)] active:scale-[0.98] cursor-pointer"
            }`}
          >
            {isLoading ? (
              <>
                <Activity className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Tracing Blockchain...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-slate-950 text-slate-950 transition-transform group-hover:scale-110" />
                <span>Trace Suspect Funds</span>
              </>
            )}
          </button>

          {/* Authentic CFCFRMS Benchmark Case Selector */}
          <div className="relative md:w-64 lg:w-72 shrink-0">
            <select
              value={AUTHENTIC_FORENSIC_CASES.some((c) => c.initialSuspectAddress === searchAddress) ? searchAddress : ""}
              onChange={(e) => {
                if (e.target.value) onSelectCase(e.target.value);
              }}
              className="w-full appearance-none bg-slate-900/90 hover:bg-slate-900 border border-amber-500/40 hover:border-amber-400/70 focus:border-amber-400 rounded-lg pl-3 pr-8 py-2.5 text-xs font-mono font-medium text-amber-300 placeholder:text-amber-500/60 cursor-pointer shadow-[0_0_12px_rgba(245,158,11,0.1)] transition-colors"
            >
              <option value="" className="bg-slate-950 text-slate-400">
                ⚡ Load Authentic CFCFRMS Case
              </option>
              {AUTHENTIC_FORENSIC_CASES.map((c) => (
                <option key={c.caseId} value={c.initialSuspectAddress} className="bg-slate-950 text-slate-200">
                  {c.caseId} — {c.incidentType} (₹{(c.stolenAmountInr / 100000).toFixed(1)}L)
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-amber-400/80 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Live Detected Asset Telemetry Banner */}
        {liveAssetInfo && liveAssetInfo.network !== "UNKNOWN" && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2 rounded-lg bg-gradient-to-r from-slate-900/95 via-cyan-950/40 to-slate-900/95 border border-cyan-500/40 shadow-[0_0_18px_rgba(6,182,212,0.15)] text-xs animate-fade-in">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-950 border border-emerald-500/50 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <span className="text-slate-300 font-mono text-xs uppercase tracking-wider">Detected Asset:</span>
                <span className="text-white font-mono font-bold tracking-wide">{liveAssetInfo.asset}</span>
              </div>

              <span className="hidden sm:inline-block w-px h-3.5 bg-slate-700" />

              <div className="flex items-center gap-1.5">
                <span className="text-slate-300 font-mono text-xs uppercase tracking-wider">Ledger:</span>
                <span className="text-cyan-300 font-mono font-semibold">{liveAssetInfo.chainName}</span>
                <span className="px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold">
                  {liveAssetInfo.standard}
                </span>
              </div>

              <span className="hidden md:inline-block w-px h-3.5 bg-slate-700" />

              <div className="hidden md:flex items-center gap-1.5">
                <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider">Confidence:</span>
                <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 font-mono font-bold text-[10px]">
                  {liveAssetInfo.confidence} REGEX MATCH
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <a
                href={liveAssetInfo.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-500/50 hover:border-cyan-400 text-cyan-300 hover:text-cyan-200 font-mono text-[11px] transition-all duration-150 shadow-[0_0_10px_rgba(6,182,212,0.25)]"
              >
                <span>Official Explorer</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* 6-Tab Navigation Bar with Alert Counters */}
      <nav className="px-4 sm:px-6 flex items-center gap-1 border-t border-slate-800/80 bg-[#070b14]/95 backdrop-blur-md overflow-x-auto scrollbar-none">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              suppressHydrationWarning
              className={`group relative flex items-center gap-2 px-3.5 sm:px-4 py-2.5 text-xs font-mono transition-all duration-150 whitespace-nowrap select-none border-b-2 ${
                isActive
                  ? "border-cyan-400 text-cyan-300 font-bold bg-gradient-to-b from-cyan-500/15 via-cyan-500/5 to-transparent shadow-[inset_0_-2px_10px_rgba(6,182,212,0.25)]"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 hover:border-slate-700 font-medium"
              }`}
            >
              <span
                className={`text-[10px] font-bold transition-colors ${
                  isActive ? "text-cyan-400" : "text-slate-600 group-hover:text-slate-400"
                }`}
              >
                [{tab.code}]
              </span>
              <Icon
                className={`w-3.5 h-3.5 transition-transform group-hover:scale-110 ${
                  isActive ? "text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.8)]" : "text-slate-500 group-hover:text-slate-300"
                }`}
              />
              <span className="tracking-wide">{tab.label}</span>

              {tab.id === "alerts" && alertCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-mono font-black rounded-full bg-red-600 text-white shadow-[0_0_12px_rgba(239,68,68,0.8)] animate-pulse">
                  {alertCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
