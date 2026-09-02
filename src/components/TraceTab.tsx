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
import { GraphTraceResult, ForensicNode, FraudPattern, PatternType, ForensicEdge, EntityType } from "@/lib/types";
import {
  Shield,
  AlertTriangle,
  X,
  Zap,
  ExternalLink,
  FileText,
  CheckCircle2,
  Sparkles,
  Copy,
  Activity,
  Layers,
  ArrowRight,
  Shuffle,
  Flame,
  Network,
  Check,
  Split,
  Eye,
  Crosshair,
  Filter,
  Compass,
  Info,
} from "lucide-react";

interface TraceTabProps {
  traceResult: GraphTraceResult | null;
  isLoading: boolean;
  onRequestNotice: () => void;
  onNavigateDossier?: () => void;
}

const NODE_THEMES: Record<string, { bg: string; border: string; text: string; glow: string; badge: string }> = {
  SUSPECT: { bg: "#1f1015", border: "#f43f5e", text: "#fda4af", glow: "rgba(244, 63, 94, 0.35)", badge: "SUSPECT INGRESS" },
  VICTIM: { bg: "#1f1015", border: "#f43f5e", text: "#fda4af", glow: "rgba(244, 63, 94, 0.35)", badge: "SUSPECT INGRESS" },
  MULE_WALLET: { bg: "#1f1810", border: "#f59e0b", text: "#fde68a", glow: "rgba(245, 158, 11, 0.35)", badge: "LAYERING MULE" },
  MIXER_OBFUSCATION: { bg: "#1e122b", border: "#a855f7", text: "#e9d5ff", glow: "rgba(168, 85, 247, 0.35)", badge: "SANCTIONED MIXER" },
  BRIDGE_CONTRACT: { bg: "#101c2b", border: "#06b6d4", text: "#a5f3fc", glow: "rgba(6, 182, 212, 0.35)", badge: "CROSS-CHAIN BRIDGE" },
  VASP_DEPOSIT_ADDRESS: { bg: "#0f172a", border: "#38bdf8", text: "#bae6fd", glow: "rgba(56, 189, 248, 0.35)", badge: "VASP DEPOSIT POOL" },
  VASP_HOT_WALLET: { bg: "#0d2018", border: "#10b981", text: "#a7f3d0", glow: "rgba(16, 185, 129, 0.35)", badge: "EXCHANGE HOT WALLET" },
  VASP_COLD_VAULT: { bg: "#0d2018", border: "#10b981", text: "#a7f3d0", glow: "rgba(16, 185, 129, 0.35)", badge: "EXCHANGE MASTER VAULT" },
  UNKNOWN: { bg: "#0f172a", border: "#475569", text: "#cbd5e1", glow: "rgba(71, 85, 105, 0.2)", badge: "UNRESOLVED NODE" },
};

function ForensicNodeCard({ data }: { data: ForensicNode }) {
  const theme = NODE_THEMES[data.entityType] || NODE_THEMES.UNKNOWN;

  return (
    <div style={{
      background: theme.bg,
      border: `2px solid ${theme.border}`,
      borderRadius: 12,
      padding: "14px 16px",
      minWidth: 260,
      maxWidth: 290,
      boxShadow: `0 0 24px ${theme.glow}`,
      position: "relative",
      cursor: "pointer",
    }}>
      <Handle type="target" position={Position.Left} style={{ background: theme.border, width: 8, height: 8 }} />

      {/* Header Badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            background: theme.border,
            boxShadow: `0 0 8px ${theme.border}`,
          }} />
          <span style={{ fontSize: 10, fontWeight: 800, color: theme.text, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {theme.badge}
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
      <div style={{ fontSize: 13, fontWeight: 800, color: "#f8fafc", marginBottom: 3 }}>
        {data.entityName || data.label}
      </div>

      {/* Address */}
      <div style={{ fontFamily: "monospace", fontSize: 10, color: "#94a3b8", marginBottom: 10 }}>
        {data.fullAddress.slice(0, 10)}...{data.fullAddress.slice(-6)}
      </div>

      {/* Metrics Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 8 }}>
        <div>
          <div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Volume Tracked</div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#10b981" }}>
            ${data.totalInflowUsd.toLocaleString()}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Current Balance</div>
          <div style={{ fontSize: 12, fontWeight: 800, color: theme.text }}>
            ${data.balanceUsd.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Sweep / Micro-Gas Indicator */}
      {data.sweepDetails && (
        <div style={{
          marginTop: 10, padding: "6px 8px", borderRadius: 6,
          background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)",
          fontSize: 10, color: "#a7f3d0", display: "flex", alignItems: "center", gap: 5,
        }}>
          <Zap size={11} color="#10b981" />
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

type ViewMode = "STUDIO" | "FOCUS_PATH" | "SPLIT_RADAR";
type RoleFilter = "ALL" | "SUSPECT" | "MULE_WALLET" | "BRIDGE_CONTRACT" | "MIXER_OBFUSCATION" | "VASP";

export default function TraceTab({ traceResult, isLoading, onRequestNotice, onNavigateDossier }: TraceTabProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<ForensicNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<ForensicEdge | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("STUDIO");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [isFocusPathActive, setIsFocusPathActive] = useState(false);
  const [aiBrief, setAiBrief] = useState<string | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  // Synchronize React Flow nodes whenever traceResult, viewMode, or roleFilter changes
  useEffect(() => {
    if (!traceResult) {
      setNodes([]);
      setEdges([]);
      setSelectedNode(null);
      setSelectedEdge(null);
      return;
    }

    const startX = 60;
    const startY = 140;
    const hopWidth = 340;
    const hopHeights: Record<number, number> = {};

    // Filter nodes based on role or focus path
    let filteredNodes = traceResult.nodes;
    if (isFocusPathActive && traceResult.focusPathNodeIds && traceResult.focusPathNodeIds.length > 0) {
      const focusSet = new Set(traceResult.focusPathNodeIds.map(id => id.toLowerCase()));
      filteredNodes = filteredNodes.filter(n => focusSet.has(n.fullAddress.toLowerCase()) || focusSet.has(n.id.toLowerCase()));
    } else if (roleFilter !== "ALL") {
      if (roleFilter === "VASP") {
        filteredNodes = filteredNodes.filter(n =>
          n.entityType === "VASP_HOT_WALLET" ||
          n.entityType === "VASP_COLD_VAULT" ||
          n.entityType === "VASP_DEPOSIT_ADDRESS"
        );
      } else {
        filteredNodes = filteredNodes.filter(n => n.entityType === roleFilter);
      }
    }

    const rfNodes: Node[] = filteredNodes.map((node) => {
      const hop = node.hopDistance;
      const countAtHop = hopHeights[hop] || 0;
      hopHeights[hop] = countAtHop + 1;

      const posX = startX + hop * hopWidth;
      const posY = startY + countAtHop * 190;

      return {
        id: node.id,
        type: "customForensicNode",
        position: { x: posX, y: posY },
        data: node,
      };
    });

    // Deduplicate edges and build ReactFlow edges
    const edgeMap = new Map<string, ForensicEdge>();
    for (const edge of traceResult.edges) {
      const dedupeKey = `${edge.source.toLowerCase()}__${edge.target.toLowerCase()}__${edge.tokenSymbol}`;
      const existing = edgeMap.get(dedupeKey);
      if (existing) {
        existing.amount += edge.amount || 0;
        existing.isSweeping = existing.isSweeping || edge.isSweeping;
        existing.isBridgeTx = existing.isBridgeTx || edge.isBridgeTx;
      } else {
        edgeMap.set(dedupeKey, { ...edge });
      }
    }

    let edgeList = Array.from(edgeMap.values());
    if (isFocusPathActive && traceResult.focusPathEdgeIds && traceResult.focusPathEdgeIds.length > 0) {
      const focusEdgeSet = new Set(traceResult.focusPathEdgeIds);
      edgeList = edgeList.filter(e => focusEdgeSet.has(e.id));
    }

    const rfEdges: Edge[] = edgeList.map((edge, idx) => ({
      id: `rf-${idx}-${edge.source.slice(0, 6)}-${edge.target.slice(0, 6)}`,
      source: edge.source,
      target: edge.target,
      label: edge.amount > 0 ? `$${edge.amount.toLocaleString()} ${edge.tokenSymbol}` : edge.tokenSymbol,
      animated: true,
      style: {
        stroke: edge.isSweeping ? "#10b981" : edge.isBridgeTx ? "#06b6d4" : "#38bdf8",
        strokeWidth: isFocusPathActive ? 3 : 2,
      },
      labelStyle: { fill: "#f8fafc", fontSize: 10, fontWeight: 700 },
      labelBgStyle: { fill: "#0f172a", fillOpacity: 0.95, stroke: "#334155", strokeWidth: 1, rx: 4 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edge.isSweeping ? "#10b981" : edge.isBridgeTx ? "#06b6d4" : "#38bdf8",
      },
      data: edge,
    }));

    setNodes(rfNodes);
    setEdges(rfEdges);
  }, [traceResult, isFocusPathActive, roleFilter, setNodes, setEdges]);

  const handleNodeClick = (_: any, node: Node) => {
    setSelectedNode(node.data as ForensicNode);
    setSelectedEdge(null);
  };

  const handleEdgeClick = (_: any, edge: Edge) => {
    setSelectedEdge(edge.data as ForensicEdge);
    setSelectedNode(null);
  };

  const handleCopyHash = () => {
    if (!traceResult?.sha256StateHash) return;
    navigator.clipboard.writeText(traceResult.sha256StateHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
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
      console.error("[AI Brief Error]", e);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const vasp = traceResult?.vaspAttribution || traceResult?.destinationVasp;
  const criminalRisk = traceResult?.criminalRiskScore || traceResult?.overallRiskScore;

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
          width: 60, height: 60, borderRadius: 16,
          background: "rgba(14, 165, 233, 0.12)",
          border: "1px solid rgba(14, 165, 233, 0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Compass size={30} color="#0ea5e9" />
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#f8fafc" }}>
          Police Forensic Studio Awaiting Suspect Address
        </div>
        <div style={{ fontSize: 13, color: "#94a3b8", maxWidth: 520, textAlign: "center", lineHeight: 1.6 }}>
          Enter a victim-reported suspect cryptocurrency wallet address in the top search bar (or select an authentic benchmark case) to execute automated multi-chain attribution and visualize the complete fund trail.
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", height: "calc(100vh - 145px)", background: "#0a0f1d", overflow: "hidden", display: "flex", flexDirection: "column" }}>

      {/* Top Police Command HUD Ribbon with Separated Metrics */}
      {traceResult && (
        <div style={{
          background: "rgba(15, 23, 42, 0.95)",
          borderBottom: "1px solid #1e293b",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* Metric 1: Independent VASP Attribution */}
            <div>
              <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>
                Attributed Destination VASP
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#38bdf8", display: "flex", alignItems: "center", gap: 8 }}>
                {vasp?.name || "Unhosted / Private Mule"}
                <span style={{
                  fontSize: 10, padding: "2px 6px", borderRadius: 4,
                  background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.3)", fontWeight: 700,
                }}>
                  {vasp?.confidenceScore || 90}% Confidence
                </span>
                {vasp?.fiuRegistered && (
                  <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "rgba(16,185,129,0.15)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)", fontWeight: 700 }}>
                    FIU-IND
                  </span>
                )}
              </div>
            </div>

            <div style={{ width: 1, height: 28, background: "#334155" }} />

            {/* Metric 2: Independent Criminal / Laundering Risk */}
            <div>
              <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>
                Criminal Laundering Risk
              </div>
              <div style={{
                fontSize: 14, fontWeight: 800,
                color: (criminalRisk?.total || 0) >= 80 ? "#ef4444" : (criminalRisk?.total || 0) >= 50 ? "#f59e0b" : "#10b981",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                {criminalRisk?.total || 0}/100
                <span style={{
                  fontSize: 10, padding: "2px 6px", borderRadius: 4,
                  background: (criminalRisk?.total || 0) >= 80 ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)",
                  color: (criminalRisk?.total || 0) >= 80 ? "#fca5a5" : "#fcd34d", fontWeight: 700,
                }}>
                  {criminalRisk?.level || "MEDIUM"}
                </span>
              </div>
            </div>

            <div style={{ width: 1, height: 28, background: "#334155" }} />

            {/* Volume Tracked */}
            <div>
              <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Total Volume Tracked</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#10b981" }}>
                ${(traceResult.totalVolumeTrackedUsd || 0).toLocaleString()} <span style={{ fontSize: 11, color: "#64748b" }}>(₹{((traceResult.totalVolumeTrackedUsd || 0) * 85).toLocaleString("en-IN")})</span>
              </div>
            </div>

            <div style={{ width: 1, height: 28, background: "#334155" }} />

            {/* Critical Path Filter & Node Filters */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                onClick={() => setIsFocusPathActive(!isFocusPathActive)}
                suppressHydrationWarning
                style={{
                  background: isFocusPathActive ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)" : "#0f172a",
                  border: isFocusPathActive ? "none" : "1px solid #334155",
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontSize: 11,
                  fontWeight: 700,
                  color: isFocusPathActive ? "white" : "#cbd5e1",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: isFocusPathActive ? "0 0 12px rgba(239, 68, 68, 0.4)" : "none",
                }}
              >
                <Crosshair size={13} /> {isFocusPathActive ? "Focus Path Active" : "Highlight Critical Path to VASP"}
              </button>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
                style={{
                  background: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  padding: "6px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#38bdf8",
                  cursor: "pointer",
                }}
              >
                <option value="ALL">Show All Nodes ({traceResult.nodes.length})</option>
                <option value="SUSPECT">Suspect Wallets</option>
                <option value="MULE_WALLET">Mule Wallets</option>
                <option value="BRIDGE_CONTRACT">Bridges &amp; Cross-Chain</option>
                <option value="MIXER_OBFUSCATION">Mixers &amp; Tumblers</option>
                <option value="VASP">Exchanges &amp; Vaults</option>
              </select>
            </div>
          </div>

          {/* Action Toolbar */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={handleGenerateAiBrief}
              disabled={isGeneratingAi}
              suppressHydrationWarning
              style={{
                background: "linear-gradient(135deg, #a855f7 0%, #6366f1 100%)",
                border: "none",
                borderRadius: 8,
                padding: "7px 14px",
                fontSize: 11,
                fontWeight: 700,
                color: "white",
                cursor: isGeneratingAi ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Sparkles size={13} /> {isGeneratingAi ? "Generating..." : "AI Senior Narrative"}
            </button>

            {onNavigateDossier && (
              <button
                onClick={onNavigateDossier}
                suppressHydrationWarning
                style={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  padding: "7px 14px",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#38bdf8",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <FileText size={13} /> Case Dossier &amp; Ledger
              </button>
            )}

            <button
              onClick={onRequestNotice}
              suppressHydrationWarning
              style={{
                background: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)",
                border: "none",
                borderRadius: 8,
                padding: "7px 16px",
                fontSize: 11,
                fontWeight: 700,
                color: "white",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 0 16px rgba(14, 165, 233, 0.35)",
              }}
            >
              <Shield size={13} /> Issue Section 94 Notice
            </button>
          </div>
        </div>
      )}

      {/* Police Operational Action Guidance Box */}
      {traceResult && (
        <div style={{
          background: "rgba(10, 15, 29, 0.98)",
          borderBottom: "1px solid #1e293b",
          padding: "8px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 12,
          color: "#cbd5e1",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Info size={14} color="#38bdf8" />
            <span>
              <strong>Police Action Advice:</strong> Funds reached {vasp?.name || "Exchange"} Hot Wallet. 
              Serve Section 94 BNSS requisition to <strong style={{ color: "#38bdf8" }}>{vasp?.complianceEmail || "compliance desk"}</strong> immediately to freeze account UIDs prior to fiat withdrawal.
            </span>
          </div>
          <div style={{ fontSize: 11, color: "#64748b" }}>
            Click any node or transaction arrow on the canvas to inspect full forensic receipt.
          </div>
        </div>
      )}

      {/* Loading Overlay */}
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
            Traversing Multi-Chain Ledger &amp; Continuing Across Bridge Routers...
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>
            Resolving on-chain transaction hashes, evaluating 2-step deposit sweeping, and computing BSA Section 63 state seal.
          </div>
        </div>
      )}

      {/* Main Spacious Canvas */}
      <div style={{ flex: 1, position: "relative" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.2}
          maxZoom={1.5}
        >
          <Background color="#1e293b" gap={24} size={1} variant={BackgroundVariant.Dots} />
          <Controls style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }} />
          <MiniMap
            nodeColor={(n) => (NODE_THEMES[n.data?.entityType]?.border || "#475569")}
            style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }}
          />
        </ReactFlow>
      </div>

      {/* Node Forensic Inspection Drawer */}
      {selectedNode && (
        <div style={{
          position: "absolute",
          top: 80,
          right: 20,
          width: 380,
          maxHeight: "calc(100% - 100px)",
          overflowY: "auto",
          background: "rgba(15, 23, 42, 0.96)",
          backdropFilter: "blur(16px)",
          border: "1px solid #334155",
          borderRadius: 14,
          padding: "20px",
          zIndex: 30,
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.6)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#f8fafc" }}>
              Node Forensic Inspection
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              suppressHydrationWarning
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
              <div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Tracked Inflow</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#10b981" }}>
                ${selectedNode.totalInflowUsd.toLocaleString()}
              </div>
            </div>
            <div style={{ background: "#0a0f1d", padding: "10px", borderRadius: 8, border: "1px solid #1e293b" }}>
              <div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Current Balance</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#f8fafc" }}>
                ${selectedNode.balanceUsd.toLocaleString()}
              </div>
            </div>
          </div>

          {selectedNode.sweepDetails && (
            <div style={{
              background: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: 8,
              padding: "12px",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
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
                Inspect on Blockchain Explorer <ExternalLink size={12} />
              </a>
            )}

            <button
              onClick={onRequestNotice}
              suppressHydrationWarning
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
              Issue Section 94 Notice for this Target
            </button>
          </div>
        </div>
      )}

      {/* Transaction Edge Click Receipt Inspector Modal */}
      {selectedEdge && (
        <div style={{
          position: "absolute",
          top: 80,
          right: 20,
          width: 380,
          background: "rgba(15, 23, 42, 0.96)",
          backdropFilter: "blur(16px)",
          border: "1px solid #38bdf8",
          borderRadius: 14,
          padding: "20px",
          zIndex: 30,
          boxShadow: "0 12px 40px rgba(14, 165, 233, 0.25)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#f8fafc", display: "flex", alignItems: "center", gap: 6 }}>
              <CheckCircle2 size={15} color="#10b981" />
              On-Chain Transaction Receipt
            </div>
            <button
              onClick={() => setSelectedEdge(null)}
              suppressHydrationWarning
              style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
            >
              <X size={15} />
            </button>
          </div>

          <div>
            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Transaction Hash</div>
            <div style={{
              fontFamily: "monospace", fontSize: 11, color: "#38bdf8",
              background: "#0a0f1d", padding: "8px 10px", borderRadius: 6,
              border: "1px solid #1e293b", marginTop: 4, wordBreak: "break-all",
            }}>
              {selectedEdge.txHash}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={{ background: "#0a0f1d", padding: "8px 10px", borderRadius: 6, border: "1px solid #1e293b" }}>
              <div style={{ fontSize: 9, color: "#64748b" }}>AMOUNT TRANSFERRED</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#10b981" }}>
                ${selectedEdge.amount.toLocaleString()} {selectedEdge.tokenSymbol}
              </div>
            </div>
            <div style={{ background: "#0a0f1d", padding: "8px 10px", borderRadius: 6, border: "1px solid #1e293b" }}>
              <div style={{ fontSize: 9, color: "#64748b" }}>BLOCK / NETWORK</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc" }}>
                {selectedEdge.network} {selectedEdge.blockNumber ? `(#${selectedEdge.blockNumber})` : ""}
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Sender ➔ Recipient</div>
            <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 2, fontFamily: "monospace" }}>
              From: {selectedEdge.source.slice(0, 10)}...{selectedEdge.source.slice(-6)}<br />
              To: {selectedEdge.target.slice(0, 10)}...{selectedEdge.target.slice(-6)}
            </div>
          </div>

          <div style={{ fontSize: 11, color: "#94a3b8" }}>
            <strong>Timestamp UTC:</strong> {selectedEdge.timestamp}<br />
            <strong>Verification Source:</strong> {selectedEdge.apiSource || "Blockchain Node Ingestion"}
          </div>

          {selectedEdge.explorerUrl && (
            <a
              href={selectedEdge.explorerUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                background: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 11,
                fontWeight: 700,
                color: "white",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              Verify on Blockchain Explorer <ExternalLink size={12} />
            </a>
          )}
        </div>
      )}

      {/* AI Senior Forensic Narrative Drawer */}
      {aiBrief && (
        <div style={{
          position: "absolute",
          bottom: 20,
          left: 20,
          width: 500,
          maxHeight: 280,
          overflowY: "auto",
          background: "rgba(15, 23, 42, 0.96)",
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
              onClick={() => setAiBrief(null)}
              suppressHydrationWarning
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
