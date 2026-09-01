"use client";

import React from "react";
import { ForensicNode } from "@/lib/types";
import { X, ExternalLink, ShieldCheck, Zap, Copy, Check } from "lucide-react";

interface NodeDrawerProps {
  node: ForensicNode | null;
  onClose: () => void;
  onGenerateNotice: () => void;
}

export const NodeDrawer: React.FC<NodeDrawerProps> = ({
  node,
  onClose,
  onGenerateNotice,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!node) return null;

  const copyAddress = () => {
    navigator.clipboard.writeText(node.fullAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="absolute right-0 top-0 bottom-0 w-96 bg-cyber-panel/95 border-l border-cyber-border backdrop-blur-xl z-30 p-6 flex flex-col shadow-2xl overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-cyber-border">
        <div>
          <span className="text-xs font-mono font-bold text-cyber-cyan uppercase">
            Forensic Node Inspection
          </span>
          <h3 className="text-base font-bold text-white truncate">{node.label}</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-cyber-card text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Address & Copy */}
      <div className="mt-4 bg-cyber-dark p-3 rounded-lg border border-cyber-border">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-slate-400 font-mono">Wallet Address</span>
          <button
            onClick={copyAddress}
            className="flex items-center gap-1 text-[11px] text-cyber-cyan hover:underline font-mono"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="font-mono text-xs text-slate-200 break-all select-all">
          {node.fullAddress}
        </div>
      </div>

      {/* Core Metrics */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 font-mono">
        <div className="bg-cyber-card p-3 rounded-lg border border-cyber-border">
          <span className="text-[10px] text-slate-400">Total Inflow</span>
          <p className="text-sm font-bold text-slate-100">${node.totalInflowUsd.toLocaleString()}</p>
        </div>
        <div className="bg-cyber-card p-3 rounded-lg border border-cyber-border">
          <span className="text-[10px] text-slate-400">Remaining Balance</span>
          <p className="text-sm font-bold text-cyber-emerald">${node.balanceUsd.toLocaleString()}</p>
        </div>
        <div className="bg-cyber-card p-3 rounded-lg border border-cyber-border">
          <span className="text-[10px] text-slate-400">Hop Distance</span>
          <p className="text-sm font-bold text-cyber-cyan">Hop #{node.hopDistance}</p>
        </div>
        <div className="bg-cyber-card p-3 rounded-lg border border-cyber-border">
          <span className="text-[10px] text-slate-400">Risk Assessment</span>
          <p className={`text-sm font-bold ${node.riskLevel === "CRITICAL" ? "text-cyber-red" : "text-cyber-gold"}`}>
            {node.riskLevel}
          </p>
        </div>
      </div>

      {/* Sweep & VASP Details */}
      {node.sweepDetails && (
        <div className="mt-4 bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-lg">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 font-mono mb-2">
            <Zap className="h-4 w-4 text-cyber-gold" />
            <span>VASP Sweeping Heuristic Flagged</span>
          </div>
          <div className="space-y-1.5 text-xs font-mono text-slate-300">
            <div>Exchange: <span className="text-white font-bold">{node.sweepDetails.exchangeName}</span></div>
            <div>Gas Refill: <span className="text-amber-400">{node.sweepDetails.gasAmount}</span></div>
            <div>Drained Ratio: <span className="text-cyber-emerald font-bold">{node.sweepDetails.sweptPercentage}% swept</span></div>
            {node.sweepDetails.fiuRegistrationNumber && (
              <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>FIU Registration: {node.sweepDetails.fiuRegistrationNumber}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-auto pt-6 space-y-2.5">
        <button
          onClick={onGenerateNotice}
          className="w-full py-2.5 bg-cyber-red hover:bg-red-600 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-2 shadow-danger"
        >
          <span>Issue Section 94 BNSS Order</span>
        </button>

        <a
          href={node.network === "ETH" ? `https://etherscan.io/address/${node.fullAddress}` : `https://tronscan.org/#/address/${node.fullAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-2 bg-cyber-card hover:bg-cyber-border text-slate-300 font-semibold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 border border-cyber-border font-mono"
        >
          <span>View on {node.network === "ETH" ? "Etherscan" : "TronScan"}</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
};
