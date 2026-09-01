"use client";

import React, { useState, useEffect } from "react";
import { TopNav } from "@/components/Header/TopNav";
import { TraceGraph } from "@/components/Canvas/TraceGraph";
import { NodeDrawer } from "@/components/Canvas/NodeDrawer";
import { MetricsPanel } from "@/components/Analytics/MetricsPanel";
import { ThreatTimeline } from "@/components/Analytics/ThreatTimeline";
import { NoticeModal } from "@/components/Legal/NoticeModal";
import { BlockchainNetwork, ForensicNode, GraphTraceResult } from "@/lib/types";
import { MOCK_CASES } from "@/lib/mock-data";

export default function ForensicDashboard() {
  const [selectedCaseId, setSelectedCaseId] = useState<string>(MOCK_CASES[0].caseId);
  const [traceResult, setTraceResult] = useState<GraphTraceResult | null>(MOCK_CASES[0].graphData);
  const [selectedNode, setSelectedNode] = useState<ForensicNode | null>(null);
  const [isNoticeOpen, setIsNoticeOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Load initial preset
  const handleSelectCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    const found = MOCK_CASES.find((c) => c.caseId === caseId);
    if (found) {
      setTraceResult(found.graphData);
      setSelectedNode(null);
    }
  };

  // Perform live / simulated trace
  const handleSearch = async (address: string, network: BlockchainNetwork) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, network, maxHops: 5 }),
      });
      if (res.ok) {
        const data: GraphTraceResult = await res.json();
        setTraceResult(data);
        setSelectedNode(null);
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex flex-col h-screen w-screen overflow-hidden bg-cyber-dark">
      {/* Top Navigation */}
      <TopNav
        onSearch={handleSearch}
        onSelectCase={handleSelectCase}
        onOpenNotice={() => setIsNoticeOpen(true)}
        isLoading={isLoading}
        selectedCaseId={selectedCaseId}
      />

      {/* Analytics Summary Bar */}
      <MetricsPanel trace={traceResult} />

      {/* Main Forensic Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <TraceGraph
          traceResult={traceResult}
          onNodeClick={(node) => setSelectedNode(node)}
        />

        {/* Inspection Drawer */}
        <NodeDrawer
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onGenerateNotice={() => setIsNoticeOpen(true)}
        />
      </div>

      {/* Chronological Audit Trail */}
      <ThreatTimeline trace={traceResult} />

      {/* Section 94 BNSS Freezing Order Modal */}
      <NoticeModal
        trace={traceResult}
        isOpen={isNoticeOpen}
        onClose={() => setIsNoticeOpen(false)}
      />
    </main>
  );
}
