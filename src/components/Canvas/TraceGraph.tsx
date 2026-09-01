"use client";

import React, { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes } from "./CustomNodes";
import { ForensicNode, GraphTraceResult } from "@/lib/types";

interface TraceGraphProps {
  traceResult: GraphTraceResult | null;
  onNodeClick: (node: ForensicNode) => void;
}

export const TraceGraph: React.FC<TraceGraphProps> = ({
  traceResult,
  onNodeClick,
}) => {
  const { nodes, edges } = useMemo(() => {
    if (!traceResult || !traceResult.nodes.length) {
      return { nodes: [], edges: [] };
    }

    // Organize nodes in horizontal layers based on hop distance
    const hopMap = new Map<number, ForensicNode[]>();
    for (const node of traceResult.nodes) {
      const h = node.hopDistance;
      if (!hopMap.has(h)) hopMap.set(h, []);
      hopMap.get(h)!.push(node);
    }

    const flowNodes: Node[] = [];
    const xSpacing = 340;
    const ySpacing = 160;

    hopMap.forEach((hopNodes, hop) => {
      hopNodes.forEach((node, idx) => {
        const yOffset = (idx - (hopNodes.length - 1) / 2) * ySpacing;
        flowNodes.push({
          id: node.id,
          type: "forensicNode",
          position: { x: hop * xSpacing + 80, y: yOffset + 240 },
          data: node as any,
        });
      });
    });

    const flowEdges: Edge[] = traceResult.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      animated: true,
      label: `$${e.amount.toLocaleString()} ${e.tokenSymbol}`,
      labelStyle: {
        fill: "#00F0FF",
        fontWeight: 700,
        fontSize: 11,
        fontFamily: "monospace",
      },
      labelBgStyle: {
        fill: "#0B101E",
        fillOpacity: 0.9,
        stroke: "#1E2C4A",
        strokeWidth: 1,
        rx: 4,
        ry: 4,
      },
      style: {
        stroke: e.isSweeping ? "#FCD34D" : (e.isPrimaryFlow ? "#00F0FF" : "#64748B"),
        strokeWidth: e.isPrimaryFlow ? 3 : 1.5,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: e.isSweeping ? "#FCD34D" : "#00F0FF",
        width: 16,
        height: 16,
      },
    }));

    return { nodes: flowNodes, edges: flowEdges };
  }, [traceResult]);

  return (
    <div className="w-full h-full relative bg-cyber-dark">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onNodeClick(node.data as any)}
        fitView
        className="bg-cyber-dark"
      >
        <Background color="#1E2C4A" gap={24} size={1.5} />
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            const data = n.data as any;
            if (data?.entityType === "VICTIM") return "#FF3366";
            if (data?.entityType === "VASP_COLD_VAULT") return "#00F0FF";
            if (data?.entityType === "VASP_DEPOSIT_ADDRESS") return "#FCD34D";
            if (data?.entityType === "MIXER_OBFUSCATION") return "#8B5CF6";
            return "#F59E0B";
          }}
          maskColor="rgba(5, 7, 13, 0.7)"
        />
      </ReactFlow>
    </div>
  );
};
