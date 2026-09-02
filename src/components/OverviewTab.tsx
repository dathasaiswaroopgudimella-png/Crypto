'use client';

import { AlertTriangle, TrendingUp, Shield, Clock, Users, CheckCircle, Zap, Layers, ArrowRight, Lock, Activity, Scale, Building2, Globe, Compass } from "lucide-react";
import { GraphTraceResult } from "@/lib/types";
import { AUTHENTIC_FORENSIC_CASES } from "@/lib/forensic-cases";

interface OverviewTabProps {
  traceResult: GraphTraceResult | null;
  onLoadCase: (address: string) => void;
  onNavigateTrace?: () => void;
}

const NATIONAL_STATS = [
  { label: "Reported to 1930 Helpline (2025)", value: "28.15 Lakh", sub: "NCRP complaints lodged nationwide", icon: Users, color: "#ef4444" },
  { label: "National Crypto Fraud Loss", value: "₹22,495 Cr", sub: "Estimated stolen across state jurisdictions", icon: TrendingUp, color: "#f59e0b" },
  { label: "Manual VASP Attribution Delay", value: "21 Days", sub: "Avg. police turnaround without automation", icon: Clock, color: "#a855f7" },
  { label: "Automated Attribution Benchmark", value: "< 1.2s", sub: "Multi-hop graph traversal across ledgers", icon: Shield, color: "#10b981" },
];

const CHAIN_METRICS = [
  { chain: "TRON (TRC-20)", asset: "USDT", latency: "180ms", status: "Operational", share: "74% Fraud Flow" },
  { chain: "Ethereum / EVM", asset: "ETH / USDC", latency: "240ms", status: "Operational", share: "16% Fraud Flow" },
  { chain: "Bitcoin (UTXO)", asset: "BTC", latency: "310ms", status: "Operational", share: "7% Fraud Flow" },
  { chain: "Solana (SPL)", asset: "SOL / USDT", latency: "120ms", status: "Operational", share: "3% Fraud Flow" },
];

export default function OverviewTab({ traceResult, onLoadCase, onNavigateTrace }: OverviewTabProps) {
  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 24, animation: "fadeIn 0.3s ease" }}>

      {/* National Context & Benchmarks */}
      <div>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            National Fraud Context &amp; Benchmark Analytics (CFCFRMS / I4C Reference Data)
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#10b981" }}>
            <Activity size={13} /> Live Multi-Chain Ingestion Active
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
          Multi-Chain Forensic Ingestion Gateway Status
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

      {/* Investigating Officer (IO) Guided Workflow */}
      <div style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        border: "1px solid #334155",
        borderRadius: 12,
        padding: "24px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <Compass size={18} color="#0ea5e9" />
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc" }}>
            Investigating Officer Operational Workflow: From FIR to Asset Freeze
          </div>
        </div>
        <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7, marginBottom: 20 }}>
          Cyber fraud syndicates follow rapid, automated pipelines to convert victim funds into untraceable cryptocurrency within minutes. 
          Stolen INR enters domestic mule accounts, is converted to crypto via P2P merchants, layered across throwaway non-custodial wallets, 
          and swept into centralized cryptocurrency exchanges (VASPs). This platform automates reverse-graph traversal to locate the exact destination VASP, 
          identify the KYC-registered account UID, and prepare statutory Section 94 BNSS preservation notices before perpetrator off-ramps.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {[
            { step: "01", label: "Suspect Wallet Ingestion", detail: "Victim reports wallet from 1930 / NCRP complaint. Ingested into multi-chain router.", color: "#ef4444" },
            { step: "02", label: "Multi-Chain Graph Crawl", detail: "BFS crawler tracks peeling chains, smurfing structures, and cross-chain bridge hops.", color: "#f59e0b" },
            { step: "03", label: "Automated VASP Attribution", detail: "Deterministic 2-step deposit sweep matching + hot wallet cluster attribution.", color: "#a855f7" },
            { step: "04", label: "Statutory Section 94 Order", detail: "Investigation-ready BNSS §94 draft + BSA §63 cryptographic seal issued to VASP nodal officer.", color: "#10b981" },
          ].map(s => (
            <div key={s.step} style={{
              background: `${s.color}0a`,
              border: `1px solid ${s.color}30`,
              borderRadius: 10,
              padding: "16px",
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: s.color, letterSpacing: "0.06em", marginBottom: 8 }}>
                STEP {s.step} — {s.label}
              </div>
              <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.5 }}>
                {s.detail}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Authentic Case Benchmarks */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
          Authentic CFCFRMS Benchmark Investigation Cases
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {AUTHENTIC_FORENSIC_CASES.map(c => (
            <div
              key={c.caseId}
              onClick={() => onLoadCase(c.initialSuspectAddress)}
              style={{
                background: "#0f172a",
                border: "1px solid #1e293b",
                borderRadius: 12,
                padding: "20px",
                cursor: "pointer",
                transition: "all 0.2s",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#38bdf8";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#1e293b";
                e.currentTarget.style.transform = "none";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#38bdf8", background: "rgba(56,189,248,0.1)", padding: "3px 8px", borderRadius: 4 }}>
                  {c.caseId}
                </span>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>{c.network}</span>
              </div>

              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc", marginBottom: 4 }}>
                  {c.incidentType}
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                  {c.caseSummary.slice(0, 140)}...
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #1e293b", paddingTop: 12, marginTop: "auto" }}>
                <div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>STOLEN VALUE</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#10b981" }}>
                    ₹{(c.stolenAmountInr / 100000).toFixed(1)} Lakh
                  </div>
                </div>

                <button
                  suppressHydrationWarning
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
