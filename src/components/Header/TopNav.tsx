"use client";

import React, { useState } from "react";
import { Shield, Search, Zap, FileText, RefreshCw, LayoutDashboard, Network, Wallet, Building2, FolderLock } from "lucide-react";
import { ActiveTab, BlockchainNetwork } from "@/lib/types";
import { MOCK_CASES } from "@/lib/mock-data";

interface TopNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onSearch: (address: string, network: BlockchainNetwork) => void;
  onSelectCase: (caseId: string) => void;
  onOpenNotice: () => void;
  isLoading: boolean;
  selectedCaseId: string;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  setActiveTab,
  onSearch,
  onSelectCase,
  onOpenNotice,
  isLoading,
  selectedCaseId,
}) => {
  const [searchInput, setSearchInput] = useState("");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      const net: BlockchainNetwork = searchInput.startsWith("0x") ? "ETH" : (searchInput.startsWith("bc1") ? "BTC" : "TRON");
      onSearch(searchInput.trim(), net);
    }
  };

  const navTabs: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Triage Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: "graph", label: "Fund Flow Graph", icon: <Network className="h-4 w-4" /> },
    { id: "wallet", label: "Wallet Deep Dive", icon: <Wallet className="h-4 w-4" /> },
    { id: "vasp", label: "VASP Intelligence", icon: <Building2 className="h-4 w-4" /> },
    { id: "cases", label: "Active 1930 Cases", icon: <FolderLock className="h-4 w-4" /> },
  ];

  return (
    <header className="bg-surface-low border-b border-border px-5 py-3 flex flex-col gap-3 sticky top-0 z-40 shadow-card">
      {/* Top Bar: Brand, Search, Preset Selector, and Freeze Order Action */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-3.5">
        {/* Brand & Emblem */}
        <div className="flex items-center justify-between w-full lg:w-auto gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-surface-card border border-brand-cyan/40 flex items-center justify-center shadow-glowCyan">
              <Shield className="h-5 w-5 text-brand-cyan" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-wide text-white font-sans">AEGIS-TRACE</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/30">
                  SIH26183
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans hidden sm:block">
                Ministry of Home Affairs (I4C) • Real-Time Crypto VASP Attribution
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-surface-highest/80 px-2.5 py-1 rounded-full border border-border-subtle text-[11px] text-slate-300 font-sans">
            <span className="h-2 w-2 rounded-full bg-brand-emerald animate-pulse" />
            <span>RPC & Gateway Active</span>
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex-1 max-w-xl w-full">
          <div className="relative flex items-center bg-surface-lowest rounded-lg border border-border focus-within:border-brand-cyan transition-all">
            <div className="pl-3 pr-2 text-slate-400">
              <Search className="h-4 w-4 text-brand-cyan" />
            </div>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search suspect wallet (0x..., T..., bc1...) or 1930 Ack Number"
              className="w-full bg-transparent py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none font-mono"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="mr-1 px-3 py-1.5 bg-brand-cyan hover:bg-sky-400 text-slate-950 font-bold text-xs rounded transition-all flex items-center gap-1"
            >
              {isLoading ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5 fill-current" />
              )}
              Trace
            </button>
          </div>
        </form>

        {/* Right Actions: Case Selector & Freezing Notice Trigger */}
        <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
          <div className="flex items-center bg-surface-card border border-border rounded-lg px-2.5 py-1 text-xs">
            <span className="text-[11px] text-slate-400 mr-2 hidden sm:inline">Case:</span>
            <select
              value={selectedCaseId}
              onChange={(e) => onSelectCase(e.target.value)}
              className="bg-transparent text-slate-200 text-xs font-sans focus:outline-none cursor-pointer"
            >
              {MOCK_CASES.map((c) => (
                <option key={c.caseId} value={c.caseId} className="bg-surface-card text-slate-200">
                  {c.title.slice(0, 32)}...
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={onOpenNotice}
            className="px-3 py-1.5 rounded-lg bg-brand-red/15 border border-brand-red/40 hover:bg-brand-red/25 text-brand-red font-semibold text-xs transition-all flex items-center gap-1.5 shadow-glowRed"
          >
            <FileText className="h-4 w-4" />
            <span>Section 94 Notice</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex items-center gap-1 border-t border-border-subtle pt-2 overflow-x-auto">
        {navTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
                isActive
                  ? "bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-surface-card"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
