"use client";

import React from "react";
import { ForensicNode, GraphTraceResult } from "@/lib/types";
import { ShieldCheck, ArrowRight, ExternalLink, Zap, AlertTriangle, Building, Copy, Check } from "lucide-react";

interface WalletDeepDiveProps {
  trace: GraphTraceResult | null;
  onOpenNotice: () => void;
}

export const WalletDeepDive: React.FC<WalletDeepDiveProps> = ({ trace, onOpenNotice }) => {
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

  if (!trace) return null;

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto h-full text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-black text-white">Wallet Investigation & Hop-by-Hop Breakdown</h1>
          <p className="text-xs text-slate-400">
            Forensic analysis of each wallet address involved in this multi-hop laundering trail
          </p>
        </div>

        <button
          onClick={onOpenNotice}
          className="px-4 py-2 bg-brand-red hover:bg-red-600 text-white font-bold text-xs rounded-lg transition-all shadow-glowRed"
        >
          Issue Section 94 Freezing Order
        </button>
      </div>

      {/* Nodes Table */}
      <div className="bg-surface-card border border-border rounded-xl overflow-hidden shadow-card">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-surface-low">
          <span className="text-xs font-bold text-slate-200">Identified Wallets in Chain</span>
          <span className="text-xs font-mono text-slate-400">{trace.nodes.length} Total Addresses</span>
        </div>

        <div className="divide-y divide-border-subtle">
          {trace.nodes.map((node, idx) => (
            <div key={node.id} className="p-4 hover:bg-surface-high/50 transition-colors space-y-3">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="h-6 w-6 rounded-full bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/30 flex items-center justify-center font-mono text-xs font-bold">
                    {node.hopDistance}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{node.label}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                        node.riskLevel === "CRITICAL" ? "bg-brand-red/15 text-brand-red border border-brand-red/30" : "bg-brand-amber/15 text-brand-amber border border-brand-amber/30"
                      }`}>
                        {node.riskLevel} Risk
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-mono text-slate-400">{node.fullAddress}</span>
                      <button
                        onClick={() => copyToClipboard(node.fullAddress, idx)}
                        className="text-brand-cyan hover:text-sky-300 p-0.5"
                      >
                        {copiedIndex === idx ? <Check className="h-3 w-3 text-brand-emerald" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="text-right">
                    <span className="text-slate-400 text-[10px] block">Inflow</span>
                    <span className="text-white font-bold">${node.totalInflowUsd.toLocaleString()}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 text-[10px] block">Remaining</span>
                    <span className={`font-bold ${node.balanceUsd > 0 ? "text-brand-emerald" : "text-slate-400"}`}>
                      ${node.balanceUsd.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sweep / Heuristic explanation in plain English */}
              {node.sweepDetails && (
                <div className="bg-brand-amber/10 border border-brand-amber/30 p-3 rounded-lg text-xs space-y-1">
                  <div className="text-brand-amber font-bold flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5" />
                    <span>VASP Deposit Sweeping Detected</span>
                  </div>
                  <p className="text-slate-300">
                    This personal deposit address received a micro-gas refill ({node.sweepDetails.gasAmount}) and immediately transferred {node.sweepDetails.sweptPercentage}% of its funds to the {node.sweepDetails.exchangeName} central vault ({node.sweepDetails.destinationVault.slice(0, 10)}...).
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
