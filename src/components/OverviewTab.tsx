'use client';

import { AlertTriangle, TrendingUp, Shield, Clock, Users, CheckCircle } from "lucide-react";
import { GraphTraceResult } from "@/lib/types";
import { AUTHENTIC_FORENSIC_CASES } from "@/lib/forensic-cases";

interface OverviewTabProps {
  traceResult: GraphTraceResult | null;
  onLoadCase: (address: string) => void;
}

const NATIONAL_STATS = [
  { label: "Reported to 1930 Helpline (2025)", value: "28.15 Lakh", sub: "Cyber fraud complaints lodged", icon: Users, color: "#ef4444" },
  { label: "Estimated Financial Loss (2025)", value: "Rs. 22,495 Cr", sub: "Confirmed stolen from Indian citizens", icon: TrendingUp, color: "#f59e0b" },
  { label: "VASP Attribution Delay (Manual)", value: "21 Days", sub: "Avg. time to identify destination exchange", icon: Clock, color: "#8b5cf6" },
  { label: "AEGIS-TRACE Attribution Speed", value: "< 1 Second", sub: "Automated multi-chain heuristic sweep", icon: Shield, color: "#10b981" },
];

export default function OverviewTab({ traceResult, onLoadCase }: OverviewTabProps) {
  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 24, animation: "fadeIn 0.3s ease" }}>

      {/* National Stats */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", letterSpacing: "0.08em", marginBottom: 14, textTransform: "uppercase" }}>
          National Threat Landscape — India Cyber Crime 2025
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {NATIONAL_STATS.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="glass-card" style={{ padding: 18 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "#475569", fontWeight: 500 }}>{stat.label}</div>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: `${stat.color}15`,
                    border: `1px solid ${stat.color}30`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon size={16} color={stat.color} />
                  </div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: stat.color, marginBottom: 4 }}>{stat.value}</div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>{stat.sub}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* How the 2-Step Sweep Works */}
      <div className="glass-card" style={{ padding: 22 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", marginBottom: 6 }}>
          How Fraudsters Move Stolen Funds in Under 18 Minutes
        </div>
        <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7, marginBottom: 18 }}>
          After a victim is defrauded, the syndicate converts the stolen rupees into USDT cryptocurrency through an unregulated peer-to-peer merchant within minutes. The funds are then passed through a chain of disposable wallets — each one holding the money for only seconds before sending it forward — until they reach a personal deposit address at a centralized exchange like Binance, CoinDCX, or WazirX. The exchange then refills that empty address with a tiny amount of gas (just enough to pay the network fee) and immediately sweeps the full balance into its master vault. At that point the funds are inside the exchange's custody and can only be recovered through a Section 94 BNSS statutory notice.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {[
            { step: "01", label: "Victim Defrauded", detail: "Funds transferred to mule bank account via RTGS or UPI", color: "#ef4444" },
            { step: "02", label: "P2P Crypto Conversion", detail: "INR converted to TRC-20 USDT through P2P merchant desk", color: "#f59e0b" },
            { step: "03", label: "Peel Chain Layering", detail: "Rapid multi-hop transfers across throwaway mule wallets", color: "#8b5cf6" },
            { step: "04", label: "Exchange Deposit & Sweep", detail: "Micro-gas refill detected. 100% balance swept to VASP vault", color: "#10b981" },
          ].map(s => (
            <div key={s.step} style={{
              background: `${s.color}08`,
              border: `1px solid ${s.color}25`,
              borderRadius: 10,
              padding: 14,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: s.color, letterSpacing: "0.06em", marginBottom: 8 }}>STEP {s.step}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>{s.detail}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Benchmark Case List */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", letterSpacing: "0.08em", marginBottom: 14, textTransform: "uppercase" }}>
          Verified Forensic Benchmark Cases
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {AUTHENTIC_FORENSIC_CASES.map((c) => (
            <div
              key={c.caseId}
              className="glass-card"
              style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
              onClick={() => onLoadCase(c.initialSuspectAddress)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 8,
                  background: c.network === "TRON" ? "rgba(239,68,68,0.1)" : c.graphData.highRiskEntitiesFound?.length > 0 ? "rgba(139,92,246,0.1)" : "rgba(59,130,246,0.1)",
                  border: `1px solid ${c.network === "TRON" ? "rgba(239,68,68,0.25)" : c.graphData.highRiskEntitiesFound?.length > 0 ? "rgba(139,92,246,0.25)" : "rgba(59,130,246,0.25)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                  color: c.network === "TRON" ? "#ef4444" : c.graphData.highRiskEntitiesFound?.length > 0 ? "#a78bfa" : "#60a5fa",
                }}>
                  {c.network}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", marginBottom: 2 }}>
                    {c.incidentType}
                    {c.graphData.highRiskEntitiesFound?.length > 0 && (
                      <span className="badge-mixer" style={{ marginLeft: 8 }}>Mixer Detected</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>
                    {c.victimName} &nbsp;·&nbsp; {c.incidentLocation} &nbsp;·&nbsp; {c.reportedDate}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#ef4444" }}>
                  Rs. {(c.stolenAmountInr / 100000).toFixed(1)} Lakh
                </div>
                <div style={{ fontSize: 11, color: "#475569" }}>${c.stolenAmountUsdt.toLocaleString()} USDT</div>
                <div style={{ fontSize: 11, color: "#3b82f6", marginTop: 4, fontWeight: 500 }}>Click to trace →</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Trace Result Summary */}
      {traceResult && (
        <div className="glass-card" style={{ padding: 20, borderColor: "#2a4a7f" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <CheckCircle size={16} color="#10b981" />
            <div style={{ fontSize: 13, fontWeight: 600, color: "#34d399" }}>Active Trace Result</div>
            <div style={{ fontSize: 11, color: "#475569", marginLeft: "auto" }}>
              Traversal completed in {traceResult.traversalDurationMs}ms
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {[
              { label: "Root Address", value: `${traceResult.rootAddress.slice(0, 10)}...`, sub: traceResult.network },
              { label: "Total Volume Tracked", value: `$${traceResult.totalVolumeTrackedUsd.toLocaleString()}`, sub: "USD equivalent" },
              { label: "Laundering Hops", value: traceResult.nodes.length - 1, sub: "Mule wallets traversed" },
              { label: "Destination Exchange", value: traceResult.destinationVasp?.name || "In Analysis", sub: traceResult.destinationVasp?.fiuNumber || "Awaiting attribution" },
            ].map(m => (
              <div key={m.label}>
                <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>{m.value}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{m.sub}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
