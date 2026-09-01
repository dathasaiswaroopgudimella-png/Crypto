"use client";

import React, { useState } from "react";
import { TopNav } from "@/components/Header/TopNav";
import { TraceGraph } from "@/components/Canvas/TraceGraph";
import { NodeDrawer } from "@/components/Canvas/NodeDrawer";
import { MetricsPanel } from "@/components/Analytics/MetricsPanel";
import { ThreatTimeline } from "@/components/Analytics/ThreatTimeline";
import { NoticeModal } from "@/components/Legal/NoticeModal";
import { OverviewTab } from "@/components/Dashboard/OverviewTab";
import { WalletDeepDive } from "@/components/Wallet/WalletDeepDive";
import { VaspDirectoryTab } from "@/components/Vasp/VaspDirectoryTab";
import { ActiveTab, BlockchainNetwork, ForensicNode, GraphTraceResult } from "@/lib/types";
import { MOCK_CASES } from "@/lib/mock-data";

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [selectedCaseId, setSelectedCaseId] = useState<string>(MOCK_CASES[0].caseId);
  const [traceResult, setTraceResult] = useState<GraphTraceResult | null>(MOCK_CASES[0].graphData);
  const [selectedNode, setSelectedNode] = useState<ForensicNode | null>(null);
  const [isNoticeOpen, setIsNoticeOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSelectCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    const found = MOCK_CASES.find((c) => c.caseId === caseId);
    if (found) {
      setTraceResult(found.graphData);
      setSelectedNode(null);
    }
  };

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
        setActiveTab("graph");
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Top Navigation & Tabs */}
      <TopNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSearch={handleSearch}
        onSelectCase={handleSelectCase}
        onOpenNotice={() => setIsNoticeOpen(true)}
        isLoading={isLoading}
        selectedCaseId={selectedCaseId}
      />

      {/* Main Tab Content */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        {activeTab === "overview" && (
          <OverviewTab
            trace={traceResult}
            onSelectCase={handleSelectCase}
            onGoToGraph={() => setActiveTab("graph")}
          />
        )}

        {activeTab === "graph" && (
          <div className="flex-1 flex flex-col h-full relative">
            <MetricsPanel trace={traceResult} />
            <div className="flex-1 relative overflow-hidden">
              <TraceGraph
                traceResult={traceResult}
                onNodeClick={(node) => setSelectedNode(node)}
              />
              <NodeDrawer
                node={selectedNode}
                onClose={() => setSelectedNode(null)}
                onGenerateNotice={() => setIsNoticeOpen(true)}
              />
            </div>
            <ThreatTimeline trace={traceResult} />
          </div>
        )}

        {activeTab === "wallet" && (
          <WalletDeepDive
            trace={traceResult}
            onOpenNotice={() => setIsNoticeOpen(true)}
          />
        )}

        {activeTab === "vasp" && <VaspDirectoryTab />}

        {activeTab === "cases" && (
          <OverviewTab
            trace={traceResult}
            onSelectCase={handleSelectCase}
            onGoToGraph={() => setActiveTab("graph")}
          />
        )}
      </div>

      {/* Section 94 BNSS Freezing Order Modal */}
      <NoticeModal
        trace={traceResult}
        isOpen={isNoticeOpen}
        onClose={() => setIsNoticeOpen(false)}
      />
    </main>
  );
}
