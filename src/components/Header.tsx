'use client';

import { useMemo } from "react";
import { Search, Shield, ChevronDown, CheckCircle2, ArrowUpRight, AlertTriangle, Activity, Database, FileText, Network } from "lucide-react";
import { AUTHENTIC_FORENSIC_CASES } from "@/lib/forensic-cases";
import { BlockchainNetwork } from "@/lib/types";
import { detectCryptoAsset } from "@/lib/rpc/multi-chain";

export type Tab = "overview" | "trace" | "vasp" | "alerts" | "legal";

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

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "overview", label: "Command Overview", icon: Activity },
  { id: "trace", label: "Fund Flow Graph", icon: Network },
  { id: "alerts", label: "Laundering Radar", icon: AlertTriangle },
  { id: "vasp", label: "VASP Intelligence", icon: Database },
  { id: "legal", label: "Legal Notices (BNSS §94)", icon: FileText },
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
  const liveAssetInfo = useMemo(() => {
    if (!searchAddress.trim()) return null;
    return detectCryptoAsset(searchAddress.trim());
  }, [searchAddress]);

  return (
    <header style={{
      background: "rgba(10, 15, 26, 0.95)",
      backdropFilter: "blur(12px)",
      borderBottom: "1px solid #1e293b",
      position: "sticky",
      top: 0,
      zIndex: 50,
    }}>
      {/* Top identity bar */}
      <div style={{
        padding: "10px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid rgba(30, 41, 59, 0.6)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: "linear-gradient(135deg, #0ea5e9 0%, #3b82f6 50%, #6366f1 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 16px rgba(14, 165, 233, 0.35)",
          }}>
            <Shield size={20} color="white" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.02em" }}>
                AEGIS-TRACE
              </span>
              <span style={{
                fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 4,
                background: "rgba(14, 165, 233, 0.15)", color: "#38bdf8", border: "1px solid rgba(14, 165, 233, 0.3)",
              }}>
                v2.0 PRO
              </span>
            </div>
            <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, letterSpacing: "0.06em" }}>
              MHA / I4C — REAL-TIME FRAUD ATTRIBUTION &amp; VASP IDENTIFICATION
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(16, 185, 129, 0.08)",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            borderRadius: 20,
            padding: "4px 12px",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
            <span style={{ fontSize: 11, color: "#34d399", fontWeight: 700 }}>
              Live Ingestion Node Active
            </span>
          </div>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>
            SIH 2026 — PS SIH26183 &amp; SIH26182
          </div>
        </div>
      </div>

      {/* Search & network selector bar */}
      <div style={{ padding: "12px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Network Selector */}
          <div style={{ position: "relative" }}>
            <select
              value={selectedNetwork}
              onChange={(e) => setSelectedNetwork(e.target.value as any)}
              style={{
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: 8,
                padding: "9px 32px 9px 12px",
                fontSize: 12,
                fontWeight: 600,
                color: "#38bdf8",
                cursor: "pointer",
                appearance: "none",
              }}
            >
              <option value="AUTO">Auto Detect Ledger</option>
              <option value="ETH">Ethereum / EVM</option>
              <option value="TRON">TRON (TRC-20 USDT)</option>
              <option value="BTC">Bitcoin (BTC)</option>
              <option value="POLYGON">Polygon PoS</option>
              <option value="SOL">Solana (SPL)</option>
              <option value="BSC">BNB Smart Chain</option>
            </select>
            <ChevronDown size={14} color="#64748b" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          </div>

          {/* Search input */}
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={15} color="#64748b" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              placeholder="Paste suspect wallet address — 0x... (ETH/Polygon/BSC), T... (TRON), bc1... (BTC), or Base58 (SOL)"
              style={{
                width: "100%",
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: 8,
                padding: "9px 12px 9px 36px",
                fontSize: 13,
                color: "#f8fafc",
                fontFamily: "monospace",
              }}
            />
          </div>

          <button
            onClick={onSearch}
            disabled={isLoading}
            style={{
              background: isLoading ? "#334155" : "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)",
              border: "none",
              borderRadius: 8,
              padding: "9px 24px",
              fontSize: 13,
              fontWeight: 700,
              color: "white",
              cursor: isLoading ? "not-allowed" : "pointer",
              boxShadow: isLoading ? "none" : "0 0 16px rgba(14, 165, 233, 0.4)",
              whiteSpace: "nowrap",
            }}
          >
            {isLoading ? "Executing BFS Trace..." : "Trace Funds"}
          </button>

          {/* Benchmark Case Selector */}
          <div style={{ position: "relative" }}>
            <select
              onChange={(e) => { if (e.target.value) onSelectCase(e.target.value); }}
              defaultValue=""
              style={{
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: 8,
                padding: "9px 32px 9px 12px",
                fontSize: 12,
                color: "#94a3b8",
                cursor: "pointer",
                appearance: "none",
              }}
            >
              <option value="" disabled>Load Authentic Benchmark Case</option>
              {AUTHENTIC_FORENSIC_CASES.map(c => (
                <option key={c.caseId} value={c.initialSuspectAddress}>
                  {c.caseId} — {c.incidentType} (₹{(c.stolenAmountInr / 100000).toFixed(1)}L)
                </option>
              ))}
            </select>
            <ChevronDown size={14} color="#64748b" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          </div>
        </div>

        {/* Live Detected Asset Telemetry Banner */}
        {liveAssetInfo && liveAssetInfo.network !== "UNKNOWN" && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "rgba(15, 23, 42, 0.8)",
            border: "1px solid #1e293b",
            borderRadius: 6,
            padding: "5px 12px",
            fontSize: 11,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <CheckCircle2 size={13} color="#10b981" />
              <span style={{ color: "#94a3b8" }}>Detected Asset:</span>
              <strong style={{ color: "#f8fafc" }}>{liveAssetInfo.asset}</strong>
            </div>
            <div style={{ color: "#334155" }}>|</div>
            <div>
              <span style={{ color: "#94a3b8" }}>Ledger:</span>{" "}
              <span style={{ color: "#38bdf8", fontWeight: 600 }}>{liveAssetInfo.chainName} ({liveAssetInfo.standard})</span>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
              <a
                href={liveAssetInfo.explorerUrl}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#38bdf8", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}
              >
                View on Official Explorer <ArrowUpRight size={11} />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Tab navigation */}
      <div style={{ padding: "0 24px", display: "flex", gap: 4, borderTop: "1px solid rgba(30, 41, 59, 0.6)" }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: isActive ? "2px solid #0ea5e9" : "2px solid transparent",
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? "#38bdf8" : "#94a3b8",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                transition: "all 0.15s",
              }}
            >
              <Icon size={14} color={isActive ? "#38bdf8" : "#64748b"} />
              {tab.label}
              {tab.id === "alerts" && alertCount > 0 && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "1px 6px",
                  borderRadius: 10,
                  background: "#ef4444",
                  color: "white",
                }}>
                  {alertCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
}
