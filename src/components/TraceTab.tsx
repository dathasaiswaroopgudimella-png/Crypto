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
import { GraphTraceResult, ForensicNode, PatternType } from "@/lib/types";
import { Shield, AlertTriangle, X, Zap, ExternalLink, FileText, CheckCircle2, Sparkles, Copy, Activity, Layers, ArrowRight } from "lucide-react";

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

export default function TraceTab({ traceResult, isLoading, onRequestNotice }: TraceTabProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<ForensicNode | null>(null);
  const [aiBrief, setAiBrief] = useState<string | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

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
    const startY = 160;
    const hopWidth = 340;
    const hopHeights: Record<number, number> = {};

    const rfNodes: Node[] = traceResult.nodes.map((node) => {
      const hop = node.hopDistance;
      const countAtHop = hopHeights[hop] || 0;
      hopHeights[hop] = countAtHop + 1;

      const posX = startX + hop * hopWidth;
      const posY = startY + countAtHop * 180;

      return {
        id: node.id,
        type: "customForensicNode",
        position: { x: posX, y: posY },
        data: node,
      };
    });

    const rfEdges: Edge[] = traceResult.edges.map((edge, idx) => ({
      id: edge.id || `edge-${idx}`,
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

  return (
    <div style={{ position: "relative", height: "calc(100vh - 145px)", background: "#0a0f1d", overflow: "hidden" }}>

      {/* Top Forensic Telemetry Ribbon */}
      {traceResult && (
        <div style={{
          position: "absolute",
          top: 14,
          left: 16,
          right: 16,
          zIndex: 20,
          background: "rgba(15, 23, 42, 0.92)",
          backdropFilter: "blur(12px)",
          border: "1px solid #334155",
          borderRadius: 12,
          padding: "10px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div>
              <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Total Volume Tracked</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#10b981" }}>
                ${(traceResult.totalVolumeTrackedUsd || 0).toLocaleString()} <span style={{ fontSize: 11, color: "#64748b" }}>(₹{((traceResult.totalVolumeTrackedUsd || 0) * 85).toLocaleString("en-IN")})</span>
              </div>
            </div>

            <div style={{ width: 1, height: 28, background: "#334155" }} />

            <div>
              <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Destination VASP</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#38bdf8", display: "flex", alignItems: "center", gap: 6 }}>
                {traceResult.destinationVasp?.name || "Unidentified Unhosted Wallet"}
                {traceResult.destinationVasp?.fiuRegistered && (
                  <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: "rgba(16,185,129,0.15)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)" }}>
                    FIU-IND Verified
                  </span>
                )}
              </div>
            </div>

            <div style={{ width: 1, height: 28, background: "#334155" }} />

            <div>
              <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Traversal Latency</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc" }}>
                {traceResult.traversalDurationMs} ms <span style={{ fontSize: 11, color: "#64748b" }}>({traceResult.nodes.length} nodes, {traceResult.maxHops} hops)</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={handleCopyHash}
              style={{
                background: "rgba(15, 23, 42, 0.8)",
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
              <Copy size={12} /> {copiedHash ? "BSA State Hash Copied!" : "Section 63 BSA Hash"}
            </button>

            <button
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
            Executing Multi-Chain Graph Traversal...
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>
            Ingesting live on-chain balances, evaluating 2-step VASP sweeps, and hashing state seal.
          </div>
        </div>
      )}

      {/* React Flow Canvas */}
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

      {/* Node Detail Drawer */}
      {selectedNode && (
        <div style={{
          position: "absolute",
          top: 70,
          right: 16,
          width: 360,
          maxHeight: "calc(100% - 90px)",
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
