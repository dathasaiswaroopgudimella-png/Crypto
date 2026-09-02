'use client';

import { useState, useEffect, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  Handle,
  Position,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import { GraphTraceResult, ForensicNode, FraudPattern, PatternType } from "@/lib/types";
import { Shield, AlertTriangle, X, Zap, ExternalLink, FileText, CheckCircle2, Sparkles, Copy, Activity, Layers, ArrowRight, Shuffle, Flame, Network, Check, LayoutGrid, Split } from "lucide-react";

interface TraceTabProps {
  traceResult: GraphTraceResult | null;
  isLoading: boolean;
  onRequestNotice: () => void;
}

const NODE_THEMES: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  VICTIM: { bg: "#1e131d", border: "#f43f5e", text: "#fda4af", glow: "rgba(244, 63, 94, 0.3)" },
  MULE_WALLET: { bg: "#1f1810", border: "#f59e0b", text: "#fde68a", glow: "rgba(245, 158, 11, 0.3)" },
  MIXER_OBFUSCATION: { bg: "#1e122b", border: "#a855f7", text: "#e9d5ff", glow: "rgba(168, 85, 247, 0.3)" },
  BRIDGE_CONTRACT: { bg: "#101c2b", border: "#06b6d4", text: "#a5f3fc", glow: "rgba(6, 182, 212, 0.3)" },
  VASP_DEPOSIT_ADDRESS: { bg: "#0f172a", border: "#38bdf8", text: "#bae6fd", glow: "rgba(56, 189, 248, 0.3)" },
  VASP_HOT_WALLET: { bg: "#0d2018", border: "#10b981", text: "#a7f3d0", glow: "rgba(16, 185, 129, 0.3)" },
  VASP_COLD_VAULT: { bg: "#0d2018", border: "#10b981", text: "#a7f3d0", glow: "rgba(16, 185, 129, 0.3)" },
  UNKNOWN: { bg: "#0f172a", border: "#475569", text: "#cbd5e1", glow: "rgba(71, 85, 105, 0.2)" },
};

const PATTERN_CONFIG: Record<PatternType, { label: string; color: string; bg: string; icon: any; severity: string }> = {
  PEELING_CHAIN: { label: "Serial Peeling Chain", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)", icon: Layers, severity: "HIGH" },
  VASP_SWEEPING: { label: "Automated VASP Sweeping", color: "#10b981", bg: "rgba(16, 185, 129, 0.1)", icon: Zap, severity: "CRITICAL" },
  MIXER_RELAY: { label: "Sanctioned Mixer / Tumbler Relay", color: "#ef4444", bg: "rgba(239, 68, 68, 0.1)", icon: Flame, severity: "CRITICAL" },
  BRIDGE_HOP: { label: "Cross-Chain Bridge Flight", color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.1)", icon: Shuffle, severity: "HIGH" },
  SMURFING: { label: "Sub-Threshold Structuring (Smurfing)", color: "#ec4899", bg: "rgba(236, 72, 153, 0.1)", icon: Activity, severity: "MEDIUM" },
  ROUND_TRIP_WASH: { label: "Circular Round-Trip Wash", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.1)", icon: Shuffle, severity: "MEDIUM" },
  CROSS_CHAIN_HOP: { label: "Inter-Ledger Cross-Chain Movement", color: "#06b6d4", bg: "rgba(6, 182, 212, 0.1)", icon: Layers, severity: "HIGH" },
};

function ForensicNodeCard({ data }: { data: ForensicNode }) {
  const theme = NODE_THEMES[data.entityType] || NODE_THEMES.UNKNOWN;

  return (
    <div style={{
      background: theme.bg,
      border: `1.5px solid ${theme.border}`,
      borderRadius: 12,
      padding: "14px 16px",
      minWidth: 240,
      maxWidth: 270,
      boxShadow: `0 0 20px ${theme.glow}`,
      position: "relative",
    }}>
      <Handle type="target" position={Position.Left} style={{ background: theme.border, width: 8, height: 8 }} />

      {/* Header Badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: theme.border,
            boxShadow: `0 0 6px ${theme.border}`,
          }} />
          <span style={{ fontSize: 10, fontWeight: 800, color: theme.text, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {data.entityType.replace(/_/g, " ")}
          </span>
        </div>

        <span style={{
          fontSize: 9, padding: "2px 6px", borderRadius: 4,
          background: "rgba(14, 165, 233, 0.15)", color: "#38bdf8",
          border: "1px solid rgba(14, 165, 233, 0.3)", fontWeight: 800,
        }}>
          {data.network}
        </span>
      </div>

      {/* Node Name / Label */}
      <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc", marginBottom: 4 }}>
        {data.entityName || data.label}
      </div>

      {/* Address */}
      <div style={{ fontFamily: "monospace", fontSize: 10, color: "#94a3b8", marginBottom: 10 }}>
        {data.fullAddress.slice(0, 10)}...{data.fullAddress.slice(-6)}
      </div>

      {/* Metrics Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 8 }}>
        <div>
          <div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Volume Tracked</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981" }}>
            ${data.totalInflowUsd.toLocaleString()}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Current Balance</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: theme.text }}>
            ${data.balanceUsd.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Sweep / Micro-Gas Indicator */}
      {data.sweepDetails && (
        <div style={{
          marginTop: 10, padding: "6px 8px", borderRadius: 6,
          background: "rgba(244, 63, 94, 0.1)", border: "1px solid rgba(244, 63, 94, 0.3)",
          fontSize: 10, color: "#fca5a5", display: "flex", alignItems: "center", gap: 5,
        }}>
          <Zap size={11} color="#f43f5e" />
          <span>Micro-gas refill + {data.sweepDetails.sweptPercentage}% sweep to {data.sweepDetails.exchangeName}</span>
        </div>
      )}

      <Handle type="source" position={Position.Right} style={{ background: theme.border, width: 8, height: 8 }} />
    </div>
  );
}

const nodeTypes = {
  customForensicNode: ForensicNodeCard,
};

type ViewMode = "SPLIT" | "GRAPH_ONLY" | "RADAR_ONLY";

export default function TraceTab({ traceResult, isLoading, onRequestNotice }: TraceTabProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<ForensicNode | null>(null);
  const [aiBrief, setAiBrief] = useState<string | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("SPLIT");

  // Synchronize React Flow nodes whenever traceResult changes
  useEffect(() => {
    if (!traceResult) {
      setNodes([]);
      setEdges([]);
      setSelectedNode(null);
      setAiBrief(null);
      return;
    }

    const startX = 60;
    const startY = 140;
    const hopWidth = 320;
    const hopHeights: Record<number, number> = {};

    const rfNodes: Node[] = traceResult.nodes.map((node) => {
      const hop = node.hopDistance;
      const countAtHop = hopHeights[hop] || 0;
      hopHeights[hop] = countAtHop + 1;

      const posX = startX + hop * hopWidth;
      const posY = startY + countAtHop * 170;

      return {
        id: node.id,
        type: "customForensicNode",
        position: { x: posX, y: posY },
        data: node,
      };
    });

    // Deduplicate edges: multiple txns between the same source→target+token collapse into one
    // (amounts are summed) to prevent ReactFlow duplicate-key warnings.
    const edgeMap = new Map<string, {
      source: string; target: string; amount: number;
      tokenSymbol: string; isSweeping: boolean; isBridgeTx: boolean;
    }>();

    for (const edge of traceResult.edges) {
      const dedupeKey = `${edge.source}__${edge.target}__${edge.tokenSymbol}`;
      const existing = edgeMap.get(dedupeKey);
      if (existing) {
        existing.amount += edge.amount || 0;
        existing.isSweeping = existing.isSweeping || edge.isSweeping;
        existing.isBridgeTx = existing.isBridgeTx || edge.isBridgeTx;
      } else {
        edgeMap.set(dedupeKey, {
          source: edge.source,
          target: edge.target,
          amount: edge.amount || 0,
          tokenSymbol: edge.tokenSymbol,
          isSweeping: edge.isSweeping,
          isBridgeTx: edge.isBridgeTx,
        });
      }
    }

    const rfEdges: Edge[] = Array.from(edgeMap.entries()).map(([dedupeKey, edge], idx) => ({
      // Always suffix with idx to guarantee uniqueness even if dedupeKey would collide
      id: `rf-edge-${idx}-${dedupeKey.slice(0, 20)}`,
      source: edge.source,
      target: edge.target,
      label: edge.amount > 0 ? `$${edge.amount.toLocaleString()} ${edge.tokenSymbol}` : edge.tokenSymbol,
      animated: true,
      style: {
        stroke: edge.isSweeping ? "#10b981" : edge.isBridgeTx ? "#06b6d4" : "#38bdf8",
        strokeWidth: 2,
      },
      labelStyle: { fill: "#f8fafc", fontSize: 10, fontWeight: 700 },
      labelBgStyle: { fill: "#0f172a", fillOpacity: 0.9, stroke: "#334155", strokeWidth: 1, rx: 4 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edge.isSweeping ? "#10b981" : edge.isBridgeTx ? "#06b6d4" : "#38bdf8",
      },
    }));

    setNodes(rfNodes);
    setEdges(rfEdges);
  }, [traceResult, setNodes, setEdges]);

  const handleNodeClick = (_: any, node: Node) => {
    setSelectedNode(node.data as ForensicNode);
  };

  const handleGenerateAiBrief = async () => {
    if (!traceResult) return;
    setIsGeneratingAi(true);
    try {
      const res = await fetch("/api/ai-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trace: traceResult }),
      });
      const data = await res.json();
      if (data.success) {
        setAiBrief(data.analysis);
      }
    } catch (e) {
      console.error("[AI Brief]", e);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleCopyHash = () => {
    if (!traceResult?.sha256StateHash) return;
    navigator.clipboard.writeText(traceResult.sha256StateHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const patterns = traceResult?.detectedPatterns || [];
  const riskScore = traceResult?.overallRiskScore;

  if (!traceResult && !isLoading) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "calc(100vh - 145px)",
        gap: 16,
        color: "#64748b",
        background: "#0a0f1d",
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: "rgba(14, 165, 233, 0.12)",
          border: "1px solid rgba(14, 165, 233, 0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Network size={28} color="#0ea5e9" />
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#f8fafc" }}>
          Investigation Workspace Awaiting Suspect Address
        </div>
        <div style={{ fontSize: 13, color: "#94a3b8", maxWidth: 520, textAlign: "center", lineHeight: 1.6 }}>
          Enter any suspect wallet address in the top search bar (or select an authentic FIR benchmark case from the dropdown) to trace the fund flow graph and view real-time laundering radar intelligence.
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", height: "calc(100vh - 145px)", background: "#0a0f1d", overflow: "hidden", display: "flex", flexDirection: "column" }}>

      {/* Top Forensic Telemetry Ribbon */}
      {traceResult && (
        <div style={{
          background: "rgba(15, 23, 42, 0.95)",
          borderBottom: "1px solid #1e293b",
          padding: "10px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div>
              <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Total Volume Tracked</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#10b981" }}>
                ${(traceResult.totalVolumeTrackedUsd || 0).toLocaleString()} <span style={{ fontSize: 11, color: "#64748b" }}>(₹{((traceResult.totalVolumeTrackedUsd || 0) * 85).toLocaleString("en-IN")})</span>
              </div>
            </div>

            <div style={{ width: 1, height: 26, background: "#334155" }} />

            <div>
              <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Destination VASP</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8", display: "flex", alignItems: "center", gap: 6 }}>
                {traceResult.destinationVasp?.name || "Unhosted / Unidentified"}
                {traceResult.destinationVasp?.fiuRegistered && (
                  <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: "rgba(16,185,129,0.15)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)" }}>
                    FIU-IND
                  </span>
                )}
              </div>
            </div>

            <div style={{ width: 1, height: 26, background: "#334155" }} />

            <div>
              <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Risk Score</div>
              <div style={{
                fontSize: 13, fontWeight: 800,
                color: (riskScore?.total || 0) >= 80 ? "#ef4444" : (riskScore?.total || 0) >= 50 ? "#f59e0b" : "#10b981",
              }}>
                {riskScore?.total || 0}/100 ({riskScore?.level || "UNKNOWN"})
              </div>
            </div>

            <div style={{ width: 1, height: 26, background: "#334155" }} />

            {/* View Mode Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#0a0f1d", border: "1px solid #1e293b", borderRadius: 8, padding: "2px" }}>
              <button
                suppressHydrationWarning
                onClick={() => setViewMode("SPLIT")}
                style={{
                  background: viewMode === "SPLIT" ? "#1e293b" : "transparent",
                  border: "none",
                  borderRadius: 6,
                  padding: "5px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: viewMode === "SPLIT" ? "#38bdf8" : "#94a3b8",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Split size={12} /> Graph + Radar
              </button>

              <button
                suppressHydrationWarning
                onClick={() => setViewMode("GRAPH_ONLY")}
                style={{
                  background: viewMode === "GRAPH_ONLY" ? "#1e293b" : "transparent",
                  border: "none",
                  borderRadius: 6,
                  padding: "5px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: viewMode === "GRAPH_ONLY" ? "#38bdf8" : "#94a3b8",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Network size={12} /> Full Canvas
              </button>

              <button
                suppressHydrationWarning
                onClick={() => setViewMode("RADAR_ONLY")}
                style={{
                  background: viewMode === "RADAR_ONLY" ? "#1e293b" : "transparent",
                  border: "none",
                  borderRadius: 6,
                  padding: "5px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: viewMode === "RADAR_ONLY" ? "#38bdf8" : "#94a3b8",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <AlertTriangle size={12} /> Laundering Radar
              </button>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              suppressHydrationWarning
              onClick={handleCopyHash}
              style={{
                background: "#0a0f1d",
                border: "1px solid #334155",
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 11,
                color: copiedHash ? "#10b981" : "#94a3b8",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Copy size={12} /> {copiedHash ? "State Hash Copied!" : "Section 63 BSA Hash"}
            </button>

            <button
              suppressHydrationWarning
              onClick={handleGenerateAiBrief}
              disabled={isGeneratingAi}
              style={{
                background: "linear-gradient(135deg, #a855f7 0%, #6366f1 100%)",
                border: "none",
                borderRadius: 8,
                padding: "6px 14px",
                fontSize: 11,
                fontWeight: 700,
                color: "white",
                cursor: isGeneratingAi ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Sparkles size={13} /> {isGeneratingAi ? "Generating..." : "AI Intelligence Brief"}
            </button>

            <button
              suppressHydrationWarning
              onClick={onRequestNotice}
              style={{
                background: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)",
                border: "none",
                borderRadius: 8,
                padding: "6px 14px",
                fontSize: 11,
                fontWeight: 700,
                color: "white",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <FileText size={13} /> Issue Section 94 Notice
            </button>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div style={{
          position: "absolute",
          inset: 0,
          background: "rgba(10, 15, 29, 0.85)",
          backdropFilter: "blur(6px)",
          zIndex: 40,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            border: "3px solid #38bdf8", borderTopColor: "transparent",
            animation: "spin 0.8s linear infinite",
          }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc" }}>
            Executing Multi-Chain Graph Traversal &amp; Pattern Analysis...
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>
            Querying live ledgers, matching 2-step VASP sweeping, detecting peeling chains, and sealing cryptographic hash.
          </div>
        </div>
      )}

      {/* Main Content Workspace Body */}
      <div style={{ flex: 1, position: "relative", display: "flex", overflow: "hidden" }}>

        {/* Left / Full: React Flow Graph Canvas */}
        {(viewMode === "SPLIT" || viewMode === "GRAPH_ONLY") && (
          <div style={{
            flex: viewMode === "SPLIT" ? "1 1 65%" : "1 1 100%",
            height: "100%",
            position: "relative",
            borderRight: viewMode === "SPLIT" ? "1px solid #1e293b" : "none",
          }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={handleNodeClick}
              nodeTypes={nodeTypes}
              fitView
              minZoom={0.2}
              maxZoom={1.5}
            >
              <Background color="#1e293b" gap={20} size={1} variant={BackgroundVariant.Dots} />
              <Controls style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }} />
              <MiniMap
                nodeColor={(n) => (NODE_THEMES[n.data?.entityType]?.border || "#475569")}
                style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }}
              />
            </ReactFlow>
          </div>
        )}

        {/* Right / Full: Laundering Typology Radar & Risk Score Panel */}
        {(viewMode === "SPLIT" || viewMode === "RADAR_ONLY") && (
          <div style={{
            flex: viewMode === "SPLIT" ? "0 0 35%" : "1 1 100%",
            height: "100%",
            overflowY: "auto",
            background: "#0c1322",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#f8fafc", display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={15} color="#ef4444" />
                Laundering Radar &amp; Typologies ({patterns.length})
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#10b981", background: "rgba(16,185,129,0.15)", padding: "2px 6px", borderRadius: 4 }}>
                Real-Time Evaluation
              </span>
            </div>

            {/* Risk Summary Card */}
            {riskScore && (
              <div style={{
                background: "#0f172a",
                border: `1px solid ${riskScore.level === "CRITICAL" ? "rgba(239,68,68,0.4)" : "rgba(245,158,11,0.4)"}`,
                borderRadius: 10,
                padding: "12px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
                <div>
                  <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Composite Risk Score</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: riskScore.level === "CRITICAL" ? "#ef4444" : "#f59e0b" }}>
                    {riskScore.total} / 100
                  </div>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 6,
                  background: riskScore.level === "CRITICAL" ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)",
                  color: riskScore.level === "CRITICAL" ? "#fca5a5" : "#fcd34d",
                }}>
                  {riskScore.level} RISK
                </span>
              </div>
            )}

            {/* Pattern Alert Cards */}
            {patterns.length === 0 ? (
              <div style={{ textAlign: "center", color: "#64748b", padding: "30px 10px", fontSize: 12 }}>
                <CheckCircle2 size={24} color="#10b981" style={{ margin: "0 auto 8px" }} />
                No high-severity laundering patterns identified on this transaction path.
              </div>
            ) : (
              patterns.map((pat, idx) => {
                const cfg = PATTERN_CONFIG[pat.patternType] || { label: pat.patternType, color: "#38bdf8", bg: "rgba(56,189,248,0.1)", icon: Activity, severity: "HIGH" };
                const Icon = cfg.icon;

                return (
                  <div
                    key={idx}
                    style={{
                      background: "#0f172a",
                      border: `1px solid ${cfg.color}35`,
                      borderRadius: 10,
                      padding: "14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 6, background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon size={14} color={cfg.color} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc" }}>{cfg.label}</span>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color }}>{pat.confidence}% Conf.</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#cbd5e1", lineHeight: 1.5 }}>
                      {pat.evidenceDescription}
                    </div>
                    <div style={{ fontSize: 10, color: "#64748b" }}>
                      <strong>Law:</strong> {pat.legislativeReference}
                    </div>
                  </div>
                );
              })
            )}

            {/* Risk Dimension Bars */}
            {riskScore?.dimensions && (
              <div style={{ borderTop: "1px solid #1e293b", paddingTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 10 }}>
                  Explainable Risk Dimensions
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {riskScore.dimensions.map((dim, idx) => (
                    <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                        <span style={{ color: "#cbd5e1", fontWeight: 600 }}>{dim.name}</span>
                        <span style={{ color: dim.score >= 80 ? "#ef4444" : dim.score >= 50 ? "#f59e0b" : "#10b981", fontWeight: 700 }}>
                          {dim.score}/100
                        </span>
                      </div>
                      <div style={{ width: "100%", height: 4, background: "#1e293b", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ width: `${dim.score}%`, height: "100%", background: dim.score >= 80 ? "#ef4444" : dim.score >= 50 ? "#f59e0b" : "#10b981" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Node Detail Drawer */}
      {selectedNode && (
        <div style={{
          position: "absolute",
          top: 60,
          right: 16,
          width: 360,
          maxHeight: "calc(100% - 80px)",
          overflowY: "auto",
          background: "rgba(15, 23, 42, 0.95)",
          backdropFilter: "blur(16px)",
          border: "1px solid #334155",
          borderRadius: 14,
          padding: "20px",
          zIndex: 30,
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.5)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#f8fafc" }}>
              Node Forensic Inspection
            </div>
            <button
              suppressHydrationWarning
              onClick={() => setSelectedNode(null)}
              style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
            >
              <X size={16} />
            </button>
          </div>

          <div>
            <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Entity Name &amp; Role</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#38bdf8", marginTop: 2 }}>
              {selectedNode.entityName || selectedNode.label}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Full Wallet Address</div>
            <div style={{
              fontFamily: "monospace", fontSize: 11, color: "#cbd5e1",
              background: "#0a0f1d", padding: "8px 10px", borderRadius: 6,
              border: "1px solid #1e293b", marginTop: 4, wordBreak: "break-all",
            }}>
              {selectedNode.fullAddress}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ background: "#0a0f1d", padding: "10px", borderRadius: 8, border: "1px solid #1e293b" }}>
              <div style={{ fontSize: 9, color: "#64748b" }}>INFLOW VOLUME</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#10b981" }}>
                ${selectedNode.totalInflowUsd.toLocaleString()}
              </div>
            </div>
            <div style={{ background: "#0a0f1d", padding: "10px", borderRadius: 8, border: "1px solid #1e293b" }}>
              <div style={{ fontSize: 9, color: "#64748b" }}>CURRENT BALANCE</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>
                ${selectedNode.balanceUsd.toLocaleString()}
              </div>
            </div>
          </div>

          {selectedNode.sweepDetails && (
            <div style={{
              background: "rgba(244, 63, 94, 0.08)",
              border: "1px solid rgba(244, 63, 94, 0.3)",
              borderRadius: 8,
              padding: "12px",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#f43f5e", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <Zap size={13} /> 2-Step VASP Sweeping Confirmed
              </div>
              <div style={{ fontSize: 11, color: "#cbd5e1", lineHeight: 1.4 }}>
                Exchange: <strong>{selectedNode.sweepDetails.exchangeName}</strong><br />
                Micro-Gas Refill: <strong>{selectedNode.sweepDetails.gasAmount || "15 TRX"}</strong><br />
                Swept Ratio: <strong>{selectedNode.sweepDetails.sweptPercentage}%</strong><br />
                Master Vault: <span style={{ fontFamily: "monospace", fontSize: 10 }}>{selectedNode.sweepDetails.destinationVault.slice(0, 12)}...</span>
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 6 }}>
            {selectedNode.assetDetails?.explorerUrl && (
              <a
                href={selectedNode.assetDetails.explorerUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  background: "#0a0f1d",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 11,
                  color: "#38bdf8",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                View on Blockchain Explorer <ExternalLink size={12} />
              </a>
            )}

            <button
              suppressHydrationWarning
              onClick={onRequestNotice}
              style={{
                background: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)",
                border: "none",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 12,
                fontWeight: 700,
                color: "white",
                cursor: "pointer",
              }}
            >
              Issue Section 94 Notice for this Entity
            </button>
          </div>
        </div>
      )}

      {/* AI Intelligence Brief Drawer */}
      {aiBrief && (
        <div style={{
          position: "absolute",
          bottom: 16,
          left: 16,
          width: 480,
          maxHeight: 280,
          overflowY: "auto",
          background: "rgba(15, 23, 42, 0.95)",
          backdropFilter: "blur(16px)",
          border: "1px solid #a855f7",
          borderRadius: 12,
          padding: "16px 20px",
          zIndex: 30,
          boxShadow: "0 12px 32px rgba(168, 85, 247, 0.25)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={16} color="#a855f7" />
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>
                I4C Senior Forensic Intelligence Narrative
              </div>
            </div>
            <button
              suppressHydrationWarning
              onClick={() => setAiBrief(null)}
              style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
            >
              <X size={14} />
            </button>
          </div>
          <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.6, whiteSpace: "pre-line" }}>
            {aiBrief}
          </div>
        </div>
      )}
    </div>
  );
}
