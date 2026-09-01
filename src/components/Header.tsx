'use client';

import { Search, Shield, ChevronDown } from "lucide-react";
import { AUTHENTIC_FORENSIC_CASES } from "@/lib/forensic-cases";

type Tab = "overview" | "trace" | "vasp" | "legal";

interface HeaderProps {
  activeTab: Tab;
  setActiveTab: (t: Tab) => void;
  searchAddress: string;
  setSearchAddress: (v: string) => void;
  onSearch: () => void;
  isLoading: boolean;
  onSelectCase: (address: string) => void;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Command Overview" },
  { id: "trace", label: "Fund Flow Trace" },
  { id: "vasp", label: "VASP Intelligence" },
  { id: "legal", label: "Legal Notices" },
];

export default function Header({
  activeTab, setActiveTab, searchAddress, setSearchAddress, onSearch, isLoading, onSelectCase,
}: HeaderProps) {
  return (
    <header style={{ background: "#0f1629", borderBottom: "1px solid #1e2d45", position: "sticky", top: 0, zIndex: 50 }}>
      {/* Top identity bar */}
      <div style={{ padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1e2d45" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: "linear-gradient(135deg, #1d4ed8 0%, #0891b2 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Shield size={20} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.01em" }}>AEGIS-TRACE</div>
            <div style={{ fontSize: 11, color: "#475569", letterSpacing: "0.06em" }}>MHA / I4C — CRYPTO FORENSIC INTELLIGENCE</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 11, color: "#475569" }}>SIH 2026 — PS SIH26183 &amp; PS SIH26182</div>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
          <div style={{ fontSize: 11, color: "#10b981" }}>All connectors live</div>
        </div>
      </div>

      {/* Search & case selector */}
      <div style={{ padding: "12px 24px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 560 }}>
          <Search size={15} color="#475569" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input
            value={searchAddress}
            onChange={e => setSearchAddress(e.target.value)}
            onKeyDown={e => e.key === "Enter" && onSearch()}
            placeholder="Enter a wallet address — 0x..., T..., bc1... — to start tracing"
            style={{
              width: "100%",
              background: "#111827",
              border: "1px solid #1e2d45",
              borderRadius: 8,
              padding: "9px 12px 9px 36px",
              fontSize: 13,
              color: "#f1f5f9",
              fontFamily: "monospace",
            }}
          />
        </div>

        <button
          onClick={onSearch}
          disabled={isLoading}
          style={{
            background: isLoading ? "#1e2d45" : "linear-gradient(135deg, #1d4ed8 0%, #0891b2 100%)",
            border: "none",
            borderRadius: 8,
            padding: "9px 20px",
            fontSize: 13,
            fontWeight: 600,
            color: "white",
            cursor: isLoading ? "not-allowed" : "pointer",
            opacity: isLoading ? 0.7 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {isLoading ? "Tracing..." : "Trace Funds"}
        </button>

        <div style={{ position: "relative" }}>
          <select
            onChange={e => { if (e.target.value) onSelectCase(e.target.value); }}
            defaultValue=""
            style={{
              background: "#111827",
              border: "1px solid #1e2d45",
              borderRadius: 8,
              padding: "9px 32px 9px 12px",
              fontSize: 12,
              color: "#94a3b8",
              cursor: "pointer",
              appearance: "none",
            }}
          >
            <option value="" disabled>Load benchmark case</option>
            {AUTHENTIC_FORENSIC_CASES.map(c => (
              <option key={c.caseId} value={c.initialSuspectAddress}>
                {c.caseId} — {c.incidentType}
              </option>
            ))}
          </select>
          <ChevronDown size={14} color="#475569" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
        </div>
      </div>

      {/* Tab navigation */}
      <div style={{ padding: "0 24px", display: "flex", gap: 0, borderTop: "1px solid #1e2d45" }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: "none",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid #3b82f6" : "2px solid transparent",
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? "#60a5fa" : "#94a3b8",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </header>
  );
}
