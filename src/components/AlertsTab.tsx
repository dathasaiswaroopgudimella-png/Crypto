'use client';

import { useMemo } from "react";
import { Shield, AlertTriangle, Zap, ArrowRight, CheckCircle2, Lock, ExternalLink, Activity, Layers, Shuffle, Flame } from "lucide-react";
import { GraphTraceResult, FraudPattern, PatternType } from "@/lib/types";

interface AlertsTabProps {
  traceResult: GraphTraceResult | null;
  onNavigateTrace: () => void;
  onRequestNotice: () => void;
}

const PATTERN_CONFIG: Record<PatternType, { label: string; color: string; bg: string; icon: any; severity: string }> = {
  PEELING_CHAIN: {
    label: "Serial Peeling Chain",
    color: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.1)",
    icon: Layers,
    severity: "HIGH",
  },
  VASP_SWEEPING: {
    label: "Automated VASP Sweeping",
    color: "#10b981",
    bg: "rgba(16, 185, 129, 0.1)",
    icon: Zap,
    severity: "CRITICAL",
  },
  MIXER_RELAY: {
    label: "Sanctioned Mixer / Tumbler Relay",
    color: "#ef4444",
    bg: "rgba(239, 68, 68, 0.1)",
    icon: Flame,
    severity: "CRITICAL",
  },
  BRIDGE_HOP: {
    label: "Cross-Chain Bridge Flight",
    color: "#8b5cf6",
    bg: "rgba(139, 92, 246, 0.1)",
    icon: Shuffle,
    severity: "HIGH",
  },
  SMURFING: {
    label: "Sub-Threshold Structuring (Smurfing)",
    color: "#ec4899",
    bg: "rgba(236, 72, 153, 0.1)",
    icon: Activity,
    severity: "MEDIUM",
  },
  ROUND_TRIP_WASH: {
    label: "Circular Round-Trip Wash",
    color: "#3b82f6",
    bg: "rgba(59, 130, 246, 0.1)",
    icon: Shuffle,
    severity: "MEDIUM",
  },
  CROSS_CHAIN_HOP: {
    label: "Inter-Ledger Cross-Chain Movement",
    color: "#06b6d4",
    bg: "rgba(6, 182, 212, 0.1)",
    icon: Layers,
    severity: "HIGH",
  },
};

export default function AlertsTab({ traceResult, onNavigateTrace, onRequestNotice }: AlertsTabProps) {
  const patterns: FraudPattern[] = useMemo(() => {
    return traceResult?.detectedPatterns || [];
  }, [traceResult]);

  const riskScore = traceResult?.overallRiskScore;

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 24, animation: "fadeIn 0.3s ease" }}>
      {/* Top Banner Header */}
      <div style={{
        background: "linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%)",
        border: "1px solid #1e293b",
        borderRadius: 12,
        padding: "20px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <AlertTriangle size={18} color="#ef4444" />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#f8fafc" }}>
              Laundering Typologies &amp; Real-Time Pattern Radar
            </div>
          </div>
          <div style={{ fontSize: 13, color: "#94a3b8" }}>
            Automated AML / PMLA 2002 heuristic pattern recognition engine detecting peeling chains, mixer hops, and exchange sweeps.
          </div>
        </div>

        {riskScore && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            background: "rgba(15, 23, 42, 0.8)",
            border: `1.5px solid ${riskScore.level === "CRITICAL" ? "#ef4444" : riskScore.level === "HIGH" ? "#f59e0b" : "#10b981"}`,
            borderRadius: 10,
            padding: "10px 18px",
          }}>
            <div>
              <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Composite Risk Score</div>
              <div style={{
                fontSize: 24,
                fontWeight: 800,
                color: riskScore.level === "CRITICAL" ? "#ef4444" : riskScore.level === "HIGH" ? "#f59e0b" : "#10b981",
              }}>
                {riskScore.total} / 100
              </div>
            </div>
            <div style={{
              fontSize: 11,
              fontWeight: 800,
              padding: "4px 10px",
              borderRadius: 6,
              background: riskScore.level === "CRITICAL" ? "rgba(239, 68, 68, 0.2)" : "rgba(245, 158, 11, 0.2)",
              color: riskScore.level === "CRITICAL" ? "#fca5a5" : "#fcd34d",
            }}>
              {riskScore.level} RISK
            </div>
          </div>
        )}
      </div>

      {/* Main Grid: Active Alerts vs Risk Dimensions */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>
        {/* Left: Active Detected Patterns List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Detected Laundering Typologies ({patterns.length})
          </div>

          {patterns.length === 0 ? (
            <div style={{
              background: "#0f172a",
              border: "1px dashed #1e293b",
              borderRadius: 12,
              padding: "48px 24px",
              textAlign: "center",
              color: "#64748b",
            }}>
              <CheckCircle2 size={36} color="#10b981" style={{ margin: "0 auto 12px" }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: "#f8fafc", marginBottom: 4 }}>
                No Laundering Patterns Flagged
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", maxWidth: 400, margin: "0 auto" }}>
                Enter any suspect wallet address in the top search bar or load a benchmark case to run real-time multi-pattern heuristics.
              </div>
            </div>
          ) : (
            patterns.map((pat, idx) => {
              const cfg = PATTERN_CONFIG[pat.patternType] || {
                label: pat.patternType,
                color: "#60a5fa",
                bg: "rgba(96, 165, 250, 0.1)",
                icon: Activity,
                severity: "HIGH",
              };
              const Icon = cfg.icon;

              return (
                <div
                  key={idx}
                  style={{
                    background: "#0f172a",
                    border: `1px solid ${cfg.color}40`,
                    borderRadius: 12,
                    padding: "18px 20px",
                    boxShadow: `0 4px 20px ${cfg.color}10`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: cfg.bg,
                        border: `1px solid ${cfg.color}50`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Icon size={16} color={cfg.color} />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc" }}>{cfg.label}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>Detected at Hop {pat.detectedAtHop}</div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 6,
                        background: `${cfg.color}20`,
                        color: cfg.color,
                        border: `1px solid ${cfg.color}40`,
                      }}>
                        {pat.confidence}% Confidence
                      </span>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 800,
                        padding: "3px 8px",
                        borderRadius: 6,
                        background: cfg.severity === "CRITICAL" ? "rgba(239, 68, 68, 0.2)" : "rgba(245, 158, 11, 0.2)",
                        color: cfg.severity === "CRITICAL" ? "#fca5a5" : "#fcd34d",
                      }}>
                        {cfg.severity}
                      </span>
                    </div>
                  </div>

                  {/* Evidence narrative */}
                  <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>
                    {pat.evidenceDescription}
                  </div>

                  {/* Statutory Reference Tag */}
                  <div style={{
                    background: "rgba(15, 23, 42, 0.6)",
                    border: "1px solid #1e293b",
                    borderRadius: 6,
                    padding: "6px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 11,
                    color: "#94a3b8",
                  }}>
                    <Lock size={12} color="#60a5fa" />
                    <span><strong>Statutory Reference:</strong> {pat.legislativeReference}</span>
                  </div>

                  {/* Action row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
                    <button
                      onClick={onNavigateTrace}
                      style={{
                        background: "transparent",
                        border: "1px solid #334155",
                        borderRadius: 6,
                        padding: "6px 12px",
                        fontSize: 11,
                        color: "#94a3b8",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      View on Graph <ArrowRight size={12} />
                    </button>
                    {pat.patternType === "VASP_SWEEPING" && (
                      <button
                        onClick={onRequestNotice}
                        style={{
                          background: "linear-gradient(135deg, #1d4ed8 0%, #0891b2 100%)",
                          border: "none",
                          borderRadius: 6,
                          padding: "6px 14px",
                          fontSize: 11,
                          fontWeight: 700,
                          color: "white",
                          cursor: "pointer",
                        }}
                      >
                        Issue Section 94 Notice
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: 6-Dimension Explainable Risk Breakdown */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Explainable Risk Scoring Breakdown
          </div>

          <div style={{
            background: "#0f172a",
            border: "1px solid #1e293b",
            borderRadius: 12,
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}>
            {riskScore?.dimensions ? (
              riskScore.dimensions.map((dim, idx) => (
                <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#f8fafc" }}>
                      {dim.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, color: "#64748b" }}>Weight {Math.round(dim.weight * 100)}%</span>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: dim.score >= 80 ? "#ef4444" : dim.score >= 50 ? "#f59e0b" : "#10b981",
                      }}>
                        {dim.score} / 100
                      </span>
                    </div>
                  </div>

                  {/* Progress Meter Bar */}
                  <div style={{
                    width: "100%", height: 6, background: "#1e293b", borderRadius: 3, overflow: "hidden",
                  }}>
                    <div style={{
                      width: `${dim.score}%`,
                      height: "100%",
                      background: dim.score >= 80 ? "linear-gradient(90deg, #f59e0b, #ef4444)" : dim.score >= 50 ? "linear-gradient(90deg, #10b981, #f59e0b)" : "#10b981",
                      borderRadius: 3,
                      transition: "width 0.5s ease",
                    }} />
                  </div>

                  <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>
                    {dim.explanation}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: "center", color: "#64748b", padding: "20px 0" }}>
                Run a trace to compute multi-factor risk dimensions.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
