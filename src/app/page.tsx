'use client';

import { useState, useCallback } from "react";
import Header, { Tab } from "@/components/Header";
import OverviewTab from "@/components/OverviewTab";
import TraceTab from "@/components/TraceTab";
import AlertsTab from "@/components/AlertsTab";
import VaspTab from "@/components/VaspTab";
import LegalTab from "@/components/LegalTab";
import { GraphTraceResult, BlockchainNetwork } from "@/lib/types";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [searchAddress, setSearchAddress] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState<BlockchainNetwork | "AUTO">("AUTO");
  const [traceResult, setTraceResult] = useState<GraphTraceResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const runTrace = useCallback(async (address?: string, isPreset: boolean = false) => {
    const target = (address || searchAddress).trim();
    if (!target) return;

    setIsLoading(true);
    setActiveTab("trace");

    try {
      const netParam = selectedNetwork === "AUTO" ? undefined : selectedNetwork;
      const res = await fetch("/api/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: target,
          network: netParam,
          isPresetCase: isPreset,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setTraceResult(json.data);
      }
    } catch (e) {
      console.error("[Trace Error]", e);
    } finally {
      setIsLoading(false);
    }
  }, [searchAddress, selectedNetwork]);

  const handleSelectCase = useCallback((address: string) => {
    setSearchAddress(address);
    runTrace(address, true);
  }, [runTrace]);

  const handleRequestNotice = useCallback(() => {
    setActiveTab("legal");
  }, []);

  const handleNavigateTrace = useCallback(() => {
    setActiveTab("trace");
  }, []);

  const alertCount = traceResult?.detectedPatterns?.length || 0;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1d", color: "#f8fafc" }}>
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchAddress={searchAddress}
        setSearchAddress={setSearchAddress}
        selectedNetwork={selectedNetwork}
        setSelectedNetwork={setSelectedNetwork}
        onSearch={() => runTrace(undefined, false)}
        isLoading={isLoading}
        onSelectCase={handleSelectCase}
        alertCount={alertCount}
      />

      <main>
        {activeTab === "overview" && (
          <OverviewTab
            traceResult={traceResult}
            onLoadCase={handleSelectCase}
            onNavigateTrace={handleNavigateTrace}
          />
        )}
        {activeTab === "trace" && (
          <TraceTab
            traceResult={traceResult}
            isLoading={isLoading}
            onRequestNotice={handleRequestNotice}
          />
        )}
        {activeTab === "alerts" && (
          <AlertsTab
            traceResult={traceResult}
            onNavigateTrace={handleNavigateTrace}
            onRequestNotice={handleRequestNotice}
          />
        )}
        {activeTab === "vasp" && <VaspTab />}
        {activeTab === "legal" && <LegalTab traceResult={traceResult} />}
      </main>
    </div>
  );
}
