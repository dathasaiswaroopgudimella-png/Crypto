'use client';

import { useState, useCallback } from "react";
import Header from "@/components/Header";
import OverviewTab from "@/components/OverviewTab";
import TraceTab from "@/components/TraceTab";
import VaspTab from "@/components/VaspTab";
import LegalTab from "@/components/LegalTab";
import { GraphTraceResult, BlockchainNetwork } from "@/lib/types";

type Tab = "overview" | "trace" | "vasp" | "legal";

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

  return (
    <div style={{ minHeight: "100vh", background: "#0a0e1a" }}>
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
      />

      <main>
        {activeTab === "overview" && (
          <OverviewTab
            traceResult={traceResult}
            onLoadCase={handleSelectCase}
          />
        )}
        {activeTab === "trace" && (
          <TraceTab
            traceResult={traceResult}
            isLoading={isLoading}
            onRequestNotice={handleRequestNotice}
          />
        )}
        {activeTab === "vasp" && <VaspTab />}
        {activeTab === "legal" && <LegalTab traceResult={traceResult} />}
      </main>
    </div>
  );
}
