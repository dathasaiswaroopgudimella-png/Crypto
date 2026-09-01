"use client";

import React from "react";
import { GraphTraceResult } from "@/lib/types";
import { ArrowDown, AlertTriangle, ShieldCheck } from "lucide-react";

interface ThreatTimelineProps {
  trace: GraphTraceResult | null;
}

export const ThreatTimeline: React.FC<ThreatTimelineProps> = ({ trace }) => {
  if (!trace) return null;

  return (
    <div className="bg-cyber-panel border-t border-cyber-border p-4 max-h-48 overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-cyber-cyan" />
          <span>Chronological Forensic Hop Audit Trail (UTC)</span>
        </span>
        <span className="text-[11px] font-mono text-slate-400">
          State Checksum: {trace.sha256StateHash.slice(0, 16)}...
        </span>
      </div>

      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 overflow-x-auto pb-2">
        {trace.nodes.map((node, idx) => (
          <React.Fragment key={node.id}>
            <div className="bg-cyber-card border border-cyber-border p-2.5 rounded-lg min-w-[200px] flex-1">
              <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                <span className="text-cyber-cyan font-bold">Hop {node.hopDistance}</span>
                <span className="text-slate-400">{node.network}</span>
              </div>
              <div className="text-xs font-bold text-white font-mono truncate">{node.label}</div>
              <div className="text-[11px] font-mono text-slate-300 mt-1">
                ${node.totalInflowUsd.toLocaleString()} USDT
              </div>
            </div>
            {idx < trace.nodes.length - 1 && (
              <div className="flex items-center justify-center text-slate-500">
                <ArrowDown className="h-4 w-4 md:-rotate-90 text-cyber-cyan/60" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
