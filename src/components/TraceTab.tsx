'use client';

import { useState, useEffect } from "react";
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
} from "reactflow";
import "reactflow/dist/style.css";
import { GraphTraceResult, ForensicNode } from "@/lib/types";
import { Shield, AlertTriangle, X, Zap, ExternalLink } from "lucide-react";

interface TraceTabProps {
  traceResult: GraphTraceResult | null;
  isLoading: boolean;
  onRequestNotice: () => void;
}

const NODE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  VICTIM: { bg: "#1a0a0a", border: "#ef4444", text: "#fca5a5" },
  MULE_WALLET: { bg: "#1a1408", border: "#f59e0b", text: "#fcd34d" },
  MIXER_OBFUSCATION: { bg: "#180d2e", border: "#8b5cf6", text: "#c4b5fd" },
  VASP_DEPOSIT_ADDRESS: { bg: "#0a1628", border: "#3b82f6", text: "#93c5fd" },
  VASP_HOT_WALLET: { bg: "#081a12", border: "#10b981", text: "#6ee7b7" },
  VASP_COLD_VAULT: { bg: "#081a12", border: "#10b981", text: "#6ee7b7" },
  UNKNOWN: { bg: "#111827", border: "#475569", text: "#94a3b8" },
};

function ForensicNodeCard({ data }: { data: ForensicNode }) {
  const palette = NODE_COLORS[data.entityType] || NODE_COLORS.UNKNOWN;
  return (
    <div style={{
      background: palette.bg,
      border: `1.5px solid ${palette.border}`,
      borderRadius: 10,
      padding: "12px 14px",
      minWidth: 220,
      maxWidth: 250,
      boxShadow: `0 0 14px ${palette.border}25`,
      position: "relative",
    }}>
      <Handle type="target" position={Position.Left} style={{ background: palette.border, width: 8, height: 8 }} />

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 6, height: 6, borderRadius: "50%",
          background: palette.border,
          boxShadow: `0 0 6px ${palette.border}`,
        }} />
        <div style={{ fontSize: 10, fontWeight: 700, color: palette.text, letterSpacing: "0.05em" }}>
          {data.entityType.replace(/_/g, " ")}
        </div>
        <span style={{
          fontSize: 9, padding: "1px 5px", borderRadius: 4,
          background: "rgba(59,130,246,0.15)", color: "#60a5fa",
          border: "1px solid rgba(59,130,246,0.3)", fontWeight: 700,
          marginLeft: "auto",
        }}>
          {data.network}
        </span>
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: "#f1f5f9", marginBottom: 4 }}>
        {data.entityName || data.label}
      </div>

      <div style={{ fontFamily: "monospace", fontSize: 10, color: "#94a3b8", marginBottom: 8 }}>
        {data.fullAddress.slice(0, 10)}...{data.fullAddress.slice(-6)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, borderTop: "1px solid #1e2d45", paddingTop: 8 }}>
        <div>
          <div style={{ fontSize: 9, color: "#475569" }}>Inflow</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#10b981" }}>${data.totalInflowUsd.toLocaleString()}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "#475569" }}>Balance</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: palette.text }}>${data.balanceUsd.toLocaleString()}</div>
        </div>
      </div>

      {data.sweepDetails && (
        <div style={{
          marginTop: 8, padding: "6px 8px", borderRadius: 6,
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          fontSize: 10, color: "#fca5a5",
        }}>
          <Zap size={10} style={{ display: "inline", marginRight: 4 }} />
          Micro-gas refill + {data.sweepDetails.sweptPercentage}% sweep
        </div>
      )}

      <Handle type="source" position={Position.Right} style={{ background: palette.border, width: 8, height: 8 }} />
    </div>
  );
}

const nodeTypes = { forensic: ForensicNodeCard };

function buildReactFlowElements(trace: GraphTraceResult) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const cols = new Map<number, number>();

  trace.nodes.forEach((fn) => {
    const hop = fn.hopDistance;
    const colCount = cols.get(hop) || 0;
    cols.set(hop, colCount + 1);

    nodes.push({
      id: fn.id,
      type: "forensic",
      data: fn,
      position: {
        x: hop * 320,
        y: colCount * 190,
      },
    });
  });

  trace.edges.forEach((fe) => {
    edges.push({
      id: fe.id,
      source: fe.source,
      target: fe.target,
      animated: fe.isPrimaryFlow,
      style: {
        stroke: fe.isSweeping ? "#ef4444" : fe.isPrimaryFlow ? "#3b82f6" : "#475569",
        strokeWidth: fe.isPrimaryFlow ? 2.5 : 1.5,
      },
      label: `${fe.tokenSymbol} $${fe.amount.toLocaleString()}`,
      labelStyle: { fontSize: 10, fill: "#94a3b8", fontFamily: "monospace" },
      labelBgStyle: { fill: "#111827", fillOpacity: 0.9 },
    });
  });

  return { nodes, edges };
}

export default function TraceTab({ traceResult, isLoading, onRequestNotice }: TraceTabProps) {
  const [selectedNode, setSelectedNode] = useState<ForensicNode | null>(null);
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([]);

  // Crucial Ralph Loop Fix: Synchronize React Flow whenever traceResult updates!
  useEffect(() => {
    if (traceResult && traceResult.nodes && traceResult.nodes.length > 0) {
      const { nodes, edges } = buildReactFlowElements(traceResult);
      setRfNodes(nodes);
      setRfEdges(edges);
      setSelectedNode(null);
    }
  }, [traceResult, setRfNodes, setRfEdges]);

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: 16 }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%",
          border: "3px solid #1e2d45", borderTopColor: "#3b82f6",
          animation: "spin 0.8s linear infinite",
        }} />
        <div style={{ fontSize: 14, color: "#94a3b8" }}>Running live multi-chain forensic traversal...</div>
        <div style={{ fontSize: 12, color: "#475569" }}>Querying live consensus nodes and token transfer logs</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!traceResult) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 12 }}>
        <Shield size={40} color="#1e2d45" />
        <div style={{ fontSize: 16, fontWeight: 600, color: "#475569" }}>No active trace</div>
        <div style={{ fontSize: 13, color: "#374151" }}>Enter a wallet address above or select an authentic benchmark case to begin</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "calc(100vh - 148px)" }}>
      {/* Graph canvas */}
      <div style={{ flex: 1, position: "relative" }}>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => setSelectedNode(node.data)}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={2}
          style={{ background: "#0a0e1a" }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1e2d45" />
          <Controls style={{ background: "#111827", border: "1px solid #1e2d45" }} />
          <MiniMap
            style={{ background: "#111827", border: "1px solid #1e2d45" }}
            nodeColor={(n) => {
              const fn: ForensicNode = n.data;
              return NODE_COLORS[fn.entityType]?.border || "#475569";
            }}
          />
        </ReactFlow>

        {/* Trace summary strip */}
        <div style={{
          position: "absolute", top: 12, left: 12, right: 12,
          background: "rgba(15,22,41,0.92)",
          backdropFilter: "blur(12px)",
          border: "1px solid #1e2d45",
          borderRadius: 10,
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: 20,
        }}>
          {[
            { label: "Target Address", value: `${traceResult.rootAddress.slice(0, 8)}...${traceResult.rootAddress.slice(-6)}`, mono: true },
            { label: "Detected Asset", value: traceResult.detectedAsset?.asset || traceResult.network },
            { label: "Volume Tracked", value: `$${traceResult.totalVolumeTrackedUsd.toLocaleString()}` },
            { label: "Hops", value: `${traceResult.nodes.length - 1}` },
            { label: "Attribution", value: traceResult.destinationVasp?.name || "Independent Wallet", highlight: !!traceResult.destinationVasp },
            { label: "Traversal Time", value: `${traceResult.traversalDurationMs}ms` },
          ].map(m => (
            <div key={m.label} style={{ whiteSpace: "nowrap" }}>
              <div style={{ fontSize: 10, color: "#475569", marginBottom: 2 }}>{m.label}</div>
              <div style={{
                fontSize: 13, fontWeight: 600,
                color: m.highlight ? "#34d399" : "#f1f5f9",
                fontFamily: m.mono ? "monospace" : "inherit",
              }}>
                {m.value}
              </div>
            </div>
          ))}

          {traceResult.destinationVasp && (
            <button
              onClick={onRequestNotice}
              style={{
                marginLeft: "auto",
                background: "linear-gradient(135deg, #991b1b, #dc2626)",
                border: "none",
                borderRadius: 7,
                padding: "7px 14px",
                fontSize: 12,
                fontWeight: 700,
                color: "white",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap",
              }}
            >
              <AlertTriangle size={13} />
              Issue Section 94 BNSS Notice
            </button>
          )}
        </div>
      </div>

      {/* Node Inspector Drawer */}
      {selectedNode && (
        <div style={{
          width: 340,
          background: "#0f1629",
          borderLeft: "1px solid #1e2d45",
          overflowY: "auto",
          padding: 20,
          animation: "slideIn 0.2s ease",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>Address Intelligence</div>
            <button onClick={() => setSelectedNode(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#475569" }}>
              <X size={16} />
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>Entity Classification</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{selectedNode.entityType.replace(/_/g, " ")}</div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>Full Address</div>
              <div style={{ fontFamily: "monospace", fontSize: 11, color: "#94a3b8", wordBreak: "break-all" }}>
                {selectedNode.fullAddress}
              </div>
            </div>

            {selectedNode.assetDetails && (
              <div>
                <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>Detected Cryptocurrency</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#38bdf8" }}>{selectedNode.assetDetails.asset}</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{selectedNode.assetDetails.chainName}</div>
                <a
                  href={selectedNode.assetDetails.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 11, color: "#60a5fa", display: "inline-flex", alignItems: "center", gap: 3, marginTop: 4, textDecoration: "none" }}
                >
                  Open on Official Explorer <ExternalLink size={10} />
                </a>
              </div>
            )}

            {selectedNode.entityName && (
              <div>
                <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>Identified Entity</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#10b981" }}>{selectedNode.entityName}</div>
                {selectedNode.fiuRegistered && (
                  <div style={{ fontSize: 11, color: "#34d399", marginTop: 2 }}>FIU-IND Registered Exchange</div>
                )}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, borderTop: "1px solid #1e2d45", paddingTop: 14 }}>
              {[
                { label: "Total Inflow", value: `$${selectedNode.totalInflowUsd.toLocaleString()}`, color: "#10b981" },
                { label: "Total Outflow", value: `$${selectedNode.totalOutflowUsd.toLocaleString()}`, color: "#ef4444" },
                { label: "Remaining Balance", value: `$${selectedNode.balanceUsd.toLocaleString()}`, color: "#f59e0b" },
                { label: "Hop Distance", value: `${selectedNode.hopDistance} hops`, color: "#94a3b8" },
              ].map(m => (
                <div key={m.label}>
                  <div style={{ fontSize: 10, color: "#475569", marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>

            {selectedNode.sweepDetails && (
              <div style={{
                background: "rgba(239,68,68,0.06)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 8,
                padding: 14,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#fca5a5", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <AlertTriangle size={13} />
                  VASP Sweeping Signature Confirmed
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    <strong style={{ color: "#f1f5f9" }}>Exchange:</strong> {selectedNode.sweepDetails.exchangeName}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    <strong style={{ color: "#f1f5f9" }}>Gas Refill:</strong> {selectedNode.sweepDetails.gasAmount}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    <strong style={{ color: "#f1f5f9" }}>Swept:</strong> {selectedNode.sweepDetails.sweptPercentage}% of total balance
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
