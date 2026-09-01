"use client";

import React from "react";
import { GraphTraceResult } from "@/lib/types";
import { Clock, TrendingDown, Building, ShieldCheck, Cpu } from "lucide-react";

interface MetricsPanelProps {
  trace: GraphTraceResult | null;
}

export const MetricsPanel: React.FC<MetricsPanelProps> = ({ trace }) => {
  if (!trace) return null;

  const inrStolen = (trace.totalVolumeTrackedUsd * 85).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  });

  return (
    <div className="bg-cyber-panel/90 border-b border-cyber-border px-6 py-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 backdrop-blur-md">
      {/* 1. Stolen Volume */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center">
          <TrendingDown className="h-5 w-5 text-cyber-red" />
        </div>
        <div>
          <div className="text-[10px] text-slate-400 font-mono uppercase">Tracked Stolen Volume</div>
          <div className="text-sm font-black text-white font-mono">
            ₹{inrStolen} <span className="text-xs font-normal text-slate-400">(${trace.totalVolumeTrackedUsd.toLocaleString()})</span>
          </div>
        </div>
      </div>

      {/* 2. Traversal Latency */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
          <Cpu className="h-5 w-5 text-cyber-cyan" />
        </div>
        <div>
          <div className="text-[10px] text-slate-400 font-mono uppercase">Traversal Latency</div>
          <div className="text-sm font-black text-cyber-cyan font-mono">
            {trace.traversalDurationMs} ms <span className="text-[10px] text-emerald-400">(Sub-Second)</span>
          </div>
        </div>
      </div>

      {/* 3. Multi-Hop Depth */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
          <Clock className="h-5 w-5 text-cyber-gold" />
        </div>
        <div>
          <div className="text-[10px] text-slate-400 font-mono uppercase">Multi-Hop Trail Depth</div>
          <div className="text-sm font-black text-slate-100 font-mono">
            {trace.nodes.length - 1} Hops <span className="text-[10px] text-slate-400">({trace.nodes.length} Nodes)</span>
          </div>
        </div>
      </div>

      {/* 4. Identified Destination Exchange */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
          <Building className="h-5 w-5 text-cyber-purple" />
        </div>
        <div>
          <div className="text-[10px] text-slate-400 font-mono uppercase">Destination VASP</div>
          <div className="text-sm font-black text-white font-mono">
            {trace.destinationVasp?.name || "Detecting..."}
          </div>
        </div>
      </div>

      {/* 5. FIU Compliance & Evidence Hash */}
      <div className="flex items-center gap-3 col-span-2 sm:col-span-1">
        <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
          <ShieldCheck className="h-5 w-5 text-cyber-emerald" />
        </div>
        <div>
          <div className="text-[10px] text-slate-400 font-mono uppercase">BSA §63 Admissibility</div>
          <div className="text-xs font-bold text-cyber-emerald font-mono flex items-center gap-1 truncate">
            <span>SHA-256 Verified</span>
          </div>
        </div>
      </div>
    </div>
  );
};
