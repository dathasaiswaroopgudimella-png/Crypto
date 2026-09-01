"use client";

import React, { useState } from "react";
import { Shield, Search, Zap, AlertTriangle, FileText, RefreshCw, Layers } from "lucide-react";
import { BlockchainNetwork } from "@/lib/types";
import { MOCK_CASES } from "@/lib/mock-data";

interface TopNavProps {
  onSearch: (address: string, network: BlockchainNetwork) => void;
  onSelectCase: (caseId: string) => void;
  onOpenNotice: () => void;
  isLoading: boolean;
  selectedCaseId: string;
}

export const TopNav: React.FC<TopNavProps> = ({
  onSearch,
  onSelectCase,
  onOpenNotice,
  isLoading,
  selectedCaseId,
}) => {
  const [searchInput, setSearchInput] = useState("");
  const [network, setNetwork] = useState<BlockchainNetwork>("TRON");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      const net: BlockchainNetwork = searchInput.startsWith("0x") ? "ETH" : "TRON";
      setNetwork(net);
      onSearch(searchInput.trim(), net);
    }
  };

  return (
    <header className="bg-cyber-panel border-b border-cyber-border px-6 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-40 shadow-lg">
      {/* Brand & Emblem */}
      <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-lg bg-cyber-card border border-cyber-cyan/40 flex items-center justify-center glow-cyan">
            <Shield className="h-6 w-6 text-cyber-cyan animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-wider text-white font-mono">AEGIS-TRACE</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/30">
                SIH26183
              </span>
            </div>
            <p className="text-xs text-slate-400 font-sans hidden sm:block">
              MHA / I4C • Real-Time Crypto VASP Attribution Engine
            </p>
          </div>
        </div>

        {/* Live Status indicator */}
        <div className="flex items-center gap-2 bg-cyber-dark/80 px-2.5 py-1 rounded-full border border-cyber-border text-xs">
          <span className="h-2 w-2 rounded-full bg-cyber-emerald animate-ping" />
          <span className="text-slate-300 font-mono text-[11px]">RPC: OPERATIONAL</span>
        </div>
      </div>

      {/* Center: Search & Ingress Input */}
      <form onSubmit={handleSearchSubmit} className="flex-1 max-w-2xl w-full">
        <div className="relative flex items-center bg-cyber-dark rounded-lg border border-cyber-border focus-within:border-cyber-cyan/70 transition-all">
          <div className="pl-3.5 pr-2 text-slate-400">
            <Search className="h-4 w-4 text-cyber-cyan" />
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Enter Suspect Wallet Address (0x... / T...) or 1930 Ack Number"
            className="w-full bg-transparent py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none font-mono"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="mr-1.5 px-4 py-1.5 bg-cyber-cyan hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded transition-all flex items-center gap-1.5"
          >
            {isLoading ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="h-3.5 w-3.5 fill-current" />
            )}
            Trace Trail
          </button>
        </div>
      </form>

      {/* Right Controls: Quick Case Scenarios & Statutory Notice Action */}
      <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
        {/* Preset Case Switcher */}
        <div className="relative flex items-center bg-cyber-card border border-cyber-border rounded-lg px-2 py-1 text-xs">
          <Layers className="h-3.5 w-3.5 text-cyber-gold mr-1.5" />
          <select
            value={selectedCaseId}
            onChange={(e) => onSelectCase(e.target.value)}
            className="bg-transparent text-slate-200 text-xs font-mono focus:outline-none cursor-pointer pr-2"
          >
            {MOCK_CASES.map((c) => (
              <option key={c.caseId} value={c.caseId} className="bg-cyber-panel text-slate-200">
                {c.title.slice(0, 36)}...
              </option>
            ))}
          </select>
        </div>

        {/* 1-Click Freeze Notice Button */}
        <button
          onClick={onOpenNotice}
          className="px-3.5 py-2 rounded-lg bg-cyber-red/10 border border-cyber-red/40 hover:bg-cyber-red/20 text-cyber-red font-semibold text-xs transition-all flex items-center gap-1.5 glow-red"
        >
          <FileText className="h-4 w-4" />
          <span>Section 94 BNSS Order</span>
        </button>
      </div>
    </header>
  );
};
