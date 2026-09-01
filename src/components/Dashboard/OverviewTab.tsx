"use client";

import React from "react";
import { GraphTraceResult } from "@/lib/types";
import { MOCK_CASES } from "@/lib/mock-data";
import { ShieldCheck, TrendingUp, AlertOctagon, Clock, ArrowRight, Zap, CheckCircle2, Building, ShieldAlert } from "lucide-react";

interface OverviewTabProps {
  trace: GraphTraceResult | null;
  onSelectCase: (caseId: string) => void;
  onGoToGraph: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  trace,
  onSelectCase,
  onGoToGraph,
}) => {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto h-full text-slate-100">
      {/* Top Banner: National Criticality & Plain-English Mission */}
      <div className="bg-gradient-to-r from-surface-card via-surface-high to-surface-card border border-border rounded-xl p-6 shadow-soft">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-red/15 text-brand-red border border-brand-red/30">
                National Cyber Security Mission
              </span>
              <span className="text-xs text-slate-400 font-sans">Ministry of Home Affairs • I4C</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Real-Time Crypto Fraud Tracing & VASP Sweeping Intelligence
            </h1>
            <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
              When victims report cyber scams on the 1930 Helpline, scammers convert stolen funds into crypto and cash out on centralized exchanges in just 18 minutes. AEGIS-TRACE automates multi-hop pathfinding across TRON, Ethereum, and Bitcoin to identify destination exchanges in under 800 milliseconds and auto-generate court-ready freezing notices.
            </p>
          </div>

          <button
            onClick={onGoToGraph}
            className="px-5 py-2.5 bg-brand-cyan hover:bg-sky-400 text-slate-950 font-bold text-sm rounded-lg transition-all flex items-center gap-2 shadow-glowCyan whitespace-nowrap"
          >
            <span>Open Interactive Graph Canvas</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-card border border-border p-4 rounded-xl shadow-card">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Annual Cyber Fraud Losses</span>
            <AlertOctagon className="h-4 w-4 text-brand-red" />
          </div>
          <div className="text-2xl font-black text-white">₹22,495 Crore</div>
          <p className="text-[11px] text-slate-400 mt-1">Across 28.15 Lakh reported incidents</p>
        </div>

        <div className="bg-surface-card border border-border p-4 rounded-xl shadow-card">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Average Police Subpoena Delay</span>
            <Clock className="h-4 w-4 text-brand-amber" />
          </div>
          <div className="text-2xl font-black text-brand-amber">7 to 21 Days</div>
          <p className="text-[11px] text-brand-emerald mt-1 font-semibold">Reduced to 800 ms with AEGIS</p>
        </div>

        <div className="bg-surface-card border border-border p-4 rounded-xl shadow-card">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Destination Attribution Speed</span>
            <Zap className="h-4 w-4 text-brand-cyan" />
          </div>
          <div className="text-2xl font-black text-brand-cyan">&lt; 800 ms</div>
          <p className="text-[11px] text-slate-400 mt-1">Deterministic VASP sweeping pattern</p>
        </div>

        <div className="bg-surface-card border border-border p-4 rounded-xl shadow-card">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Legal Admissibility</span>
            <ShieldCheck className="h-4 w-4 text-brand-emerald" />
          </div>
          <div className="text-2xl font-black text-brand-emerald">100% Compliant</div>
          <p className="text-[11px] text-slate-400 mt-1">Section 94 BNSS & §63 BSA 2023</p>
        </div>
      </div>

      {/* Two Column Section: Live VASP Sweeping Feed & Active 1930 Cases */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active 1930 Cyber Fraud Cases */}
        <div className="lg:col-span-2 bg-surface-card border border-border rounded-xl p-5 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div>
              <h2 className="text-base font-bold text-white">Active 1930 Cyber Crime Cases</h2>
              <p className="text-xs text-slate-400">Select a real-world incident to load its full forensic graph trail</p>
            </div>
            <span className="text-xs font-mono text-brand-cyan">{MOCK_CASES.length} Cases Loaded</span>
          </div>

          <div className="space-y-3">
            {MOCK_CASES.map((c) => (
              <div
                key={c.caseId}
                onClick={() => {
                  onSelectCase(c.caseId);
                  onGoToGraph();
                }}
                className="bg-surface-low hover:bg-surface-high border border-border-subtle hover:border-brand-cyan/50 p-4 rounded-lg cursor-pointer transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono text-brand-cyan">{c.complaintNumber}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-highest text-slate-300 font-mono">
                      {c.network}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-white group-hover:text-brand-cyan transition-colors">
                    {c.title}
                  </h3>
                  <p className="text-xs text-slate-400 max-w-xl line-clamp-2">
                    {c.crimeDescription}
                  </p>
                </div>

                <div className="text-right sm:min-w-[120px]">
                  <div className="text-sm font-bold text-brand-red">₹{c.stolenInr.toLocaleString("en-IN")}</div>
                  <div className="text-xs text-slate-400 font-mono">${c.stolenUsdt.toLocaleString()} USDT</div>
                  <div className="text-[11px] text-brand-cyan mt-1 flex items-center justify-end gap-1 font-semibold">
                    <span>Inspect Trail</span>
                    <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 1 Col: How AEGIS Identifies Exchanges Plainly */}
        <div className="bg-surface-card border border-border rounded-xl p-5 shadow-card space-y-4">
          <div className="border-b border-border-subtle pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Building className="h-4 w-4 text-brand-amber" />
              <span>How We Spot Exchanges</span>
            </h2>
            <p className="text-xs text-slate-400">Zero private KYC data required</p>
          </div>

          <div className="space-y-3.5 text-xs text-slate-300">
            <div className="bg-surface-low p-3 rounded-lg border border-border-subtle space-y-1">
              <div className="font-bold text-white flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand-cyan" />
                <span>Step 1: Micro-Gas Refill</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                When a victim deposits USDT into a personal exchange deposit address, that address has zero TRX or ETH. The exchange parent hot wallet must first send a micro-gas refill (e.g. 15 TRX).
              </p>
            </div>

            <div className="bg-surface-low p-3 rounded-lg border border-border-subtle space-y-1">
              <div className="font-bold text-white flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand-amber" />
                <span>Step 2: 100% Vault Sweep</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Immediately after the gas refill, a sweep transaction drains 100% of the deposit into the central exchange vault (Binance, CoinDCX, etc.). Our engine flags this mathematical signature instantly.
              </p>
            </div>

            <div className="bg-surface-low p-3 rounded-lg border border-border-subtle space-y-1">
              <div className="font-bold text-white flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand-emerald" />
                <span>Step 3: Instant Section 94 Notice</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                In 1 click, our tool generates an official Section 94 BNSS Police Freeze Order with exact hashes ready to be emailed to the exchange compliance team.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
