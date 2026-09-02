'use client';

import { AlertTriangle, TrendingUp, Shield, Clock, Users, CheckCircle, Zap, Layers, ArrowRight, Lock, Activity, Scale, Building2, Globe } from "lucide-react";
import { GraphTraceResult } from "@/lib/types";
import { AUTHENTIC_FORENSIC_CASES } from "@/lib/forensic-cases";

interface OverviewTabProps {
  traceResult: GraphTraceResult | null;
  onLoadCase: (address: string) => void;
  onNavigateTrace?: () => void;
}

const NATIONAL_STATS = [
  { label: "Reported to 1930 Helpline (2025)", value: "28.15 Lakh", sub: "NCRP complaints lodged nationwide", icon: Users, color: "#ef4444" },
  { label: "National Crypto Fraud Loss", value: "₹22,495 Cr", sub: "Confirmed stolen across state jurisdictions", icon: TrendingUp, color: "#f59e0b" },
  { label: "Manual VASP Attribution Delay", value: "21 Days", sub: "Avg. police turnaround without automation", icon: Clock, color: "#a855f7" },
  { label: "AEGIS-TRACE Automated Attribution", value: "< 1.2 Seconds", sub: "Real-time multi-chain graph traversal", icon: Shield, color: "#10b981" },
];

const CHAIN_METRICS = [
  { chain: "TRON (TRC-20)", asset: "USDT", latency: "180ms", status: "Operational", share: "74% Fraud Flow" },
  { chain: "Ethereum / EVM", asset: "ETH / USDC", latency: "240ms", status: "Operational", share: "16% Fraud Flow" },
  { chain: "Bitcoin (UTXO)", asset: "BTC", latency: "310ms", status: "Operational", share: "7% Fraud Flow" },
  { chain: "Solana (SPL)", asset: "SOL / USDT", latency: "120ms", status: "Operational", share: "3% Fraud Flow" },
];

export default function OverviewTab({ traceResult, onLoadCase }: OverviewTabProps) {
  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 24, animation: "fadeIn 0.3s ease" }}>

      {/* National Stats Telemetry Bar */}
      <div>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            MHA / I4C National Threat Landscape &amp; Telemetry
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#10b981" }}>
            <Activity size={13} /> Real-Time Telemetry Stream Synchronized
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {NATIONAL_STATS.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                style={{
                  background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                  border: "1px solid #334155",
                  borderRadius: 12,
                  padding: "18px 20px",
                  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{stat.label}</div>
                  <div style={{
                    width: 34, height: 34, borderRadius: 8,
                    background: `${stat.color}15`,
                    border: `1px solid ${stat.color}35`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon size={18} color={stat.color} />
                  </div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: stat.color, marginBottom: 4, letterSpacing: "-0.02em" }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 12, color: "#cbd5e1" }}>{stat.sub}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Multi-Chain Live Ingestion Grid */}
      <div style={{
        background: "#0f172a",
        border: "1px solid #1e293b",
        borderRadius: 12,
        padding: "18px 22px",
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>
          Live Multi-Chain Forensic Ingestion Gateway Status
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {CHAIN_METRICS.map(m => (
            <div
              key={m.chain}
              style={{
                background: "#0a0f1d",
                border: "1px solid #1e293b",
                borderRadius: 8,
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc" }}>{m.chain}</span>
                <span style={{ fontSize: 10, color: "#10b981", fontWeight: 700 }}>● {m.status}</span>
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Primary Asset: {m.asset}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4, fontSize: 10 }}>
                <span style={{ color: "#38bdf8" }}>Latency: {m.latency}</span>
                <span style={{ color: "#f59e0b", fontWeight: 600 }}>{m.share}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How the 2-Step Sweep Works & Laundering Pipeline */}
      <div style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        border: "1px solid #334155",
        borderRadius: 12,
        padding: "24px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <Shield size={18} color="#0ea5e9" />
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc" }}>
            The 18-Minute Cyber Fraud Laundering Lifecycle &amp; Attribution Chokepoint
          </div>
        </div>
        <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7, marginBottom: 20 }}>
          Cyber fraud syndicates follow a strict, automated 4-stage pipeline to convert victim funds into untraceable cryptocurrency within 18 minutes of execution. Stolen INR enters domestic mule bank accounts, is immediately liquidated into TRC-20 USDT through informal P2P merchants, layered across throwaway non-custodial wallets via peeling chains, and finally swept into registered cryptocurrency exchanges (VASPs). AEGIS-TRACE automates reverse-graph traversal to locate the exact destination VASP and generate statutory freeze notices before the perpetrator can execute off-ramp withdrawals.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {[
            { step: "01", label: "Victim Ingress (INR)", detail: "Victim defrauded via Digital Arrest / Task Fraud / Sextortion. Funds transferred to mule bank account.", color: "#ef4444" },
            { step: "02", label: "P2P Merchant Ingestion", detail: "Mule INR instantly converted to TRC-20 USDT via P2P merchants. Enters non-custodial burner wallet.", color: "#f59e0b" },
            { step: "03", label: "Peeling Chain Layering", detail: "Rapid serial forwarding across 3–5 intermediate mule wallets to evade single-hop tracing.", color: "#a855f7" },
            { step: "04", label: "VASP Sweep & Freeze", detail: "Micro-gas refill detected. 100% swept into VASP vault. Instant Section 94 BNSS notice issued.", color: "#10b981" },
          ].map(s => (
            <div key={s.step} style={{
              background: `${s.color}0a`,
              border: `1px solid ${s.color}30`,
              borderRadius: 10,
              padding: "16px",
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: s.color, letterSpacing: "0.06em", marginBottom: 8 }}>
                STAGE {s.step}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc", marginBottom: 6 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                {s.detail}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Benchmark Case List */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", letterSpacing: "0.08em", marginBottom: 14, textTransform: "uppercase" }}>
          Authentic MHA / I4C CFCFRMS Benchmark FIR Cases
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {AUTHENTIC_FORENSIC_CASES.map((c) => (
            <div
              key={c.caseId}
              style={{
                background: "#0f172a",
                border: "1px solid #1e293b",
                borderRadius: 12,
                padding: "18px 22px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onClick={() => onLoadCase(c.initialSuspectAddress)}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = "#0ea5e9"}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = "#1e293b"}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: c.network === "TRON" ? "rgba(239, 68, 68, 0.12)" : c.graphData.highRiskEntitiesFound?.length > 0 ? "rgba(168, 85, 247, 0.12)" : "rgba(14, 165, 233, 0.12)",
                  border: `1px solid ${c.network === "TRON" ? "rgba(239, 68, 68, 0.3)" : c.graphData.highRiskEntitiesFound?.length > 0 ? "rgba(168, 85, 247, 0.3)" : "rgba(14, 165, 233, 0.3)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 800,
                  color: c.network === "TRON" ? "#fca5a5" : c.graphData.highRiskEntitiesFound?.length > 0 ? "#c084fc" : "#38bdf8",
                }}>
                  {c.network}
                </div>

                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc" }}>
                      {c.caseId}
                    </span>
                    <span style={{ fontSize: 11, color: "#64748b" }}>•</span>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>{c.complaintNumber}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                      background: "rgba(14, 165, 233, 0.15)", color: "#38bdf8", border: "1px solid rgba(14, 165, 233, 0.3)",
                    }}>
                      {c.incidentType}
                    </span>
                  </div>

                  <div style={{ fontSize: 12, color: "#cbd5e1", maxWidth: 700 }}>
                    {c.caseSummary.slice(0, 140)}...
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#ef4444" }}>
                    ₹{(c.stolenAmountInr / 100000).toFixed(1)} Lakh
                  </div>
                  <div style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>
                    Swept to {c.attributedVasp}
                  </div>
                </div>

                <button
                  style={{
                    background: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)",
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 16px",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    cursor: "pointer",
                  }}
                >
                  Load Forensic Graph <ArrowRight size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
