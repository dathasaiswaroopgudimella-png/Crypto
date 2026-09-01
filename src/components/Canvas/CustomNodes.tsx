"use client";

import React from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { ForensicNode } from "@/lib/types";
import { ShieldAlert, UserX, Building2, Flame, ArrowRightLeft, CheckCircle2 } from "lucide-react";

export const ForensicNodeComponent: React.FC<NodeProps> = ({ data, selected }) => {
  const node = data as unknown as ForensicNode;

  let borderColor = "border-slate-700";
  let bgGradient = "from-slate-900 to-slate-950";
  let badgeColor = "bg-slate-800 text-slate-300 border-slate-600";
  let icon = <ArrowRightLeft className="h-4 w-4 text-slate-400" />;
  let typeLabel = "Mule Intermediary";

  if (node.entityType === "VICTIM") {
    borderColor = "border-cyber-red";
    bgGradient = "from-red-950/40 to-slate-950";
    badgeColor = "bg-red-500/20 text-red-400 border-red-500/40";
    icon = <ShieldAlert className="h-4 w-4 text-cyber-red" />;
    typeLabel = "Victim Ingress (1930)";
  } else if (node.entityType === "VASP_DEPOSIT_ADDRESS") {
    borderColor = "border-cyber-gold";
    bgGradient = "from-amber-950/40 to-slate-950";
    badgeColor = "bg-amber-500/20 text-amber-400 border-amber-500/40";
    icon = <Building2 className="h-4 w-4 text-cyber-gold" />;
    typeLabel = `VASP Deposit (${node.entityName || "Exchange"})`;
  } else if (node.entityType === "VASP_HOT_WALLET" || node.entityType === "VASP_COLD_VAULT") {
    borderColor = "border-cyber-cyan";
    bgGradient = "from-cyan-950/50 to-slate-950";
    badgeColor = "bg-cyan-500/20 text-cyan-400 border-cyan-500/40";
    icon = <CheckCircle2 className="h-4 w-4 text-cyber-cyan" />;
    typeLabel = `${node.entityName || "VASP"} Vault`;
  } else if (node.entityType === "MIXER_OBFUSCATION") {
    borderColor = "border-cyber-purple";
    bgGradient = "from-purple-950/40 to-slate-950";
    badgeColor = "bg-purple-500/20 text-purple-400 border-purple-500/40";
    icon = <Flame className="h-4 w-4 text-cyber-purple" />;
    typeLabel = "High-Risk Mixer";
  } else {
    icon = <UserX className="h-4 w-4 text-amber-400" />;
    typeLabel = `Mule Hop ${node.hopDistance}`;
  }

  return (
    <div
      className={`relative rounded-xl border-2 ${borderColor} bg-gradient-to-b ${bgGradient} p-4 min-w-[260px] shadow-2xl backdrop-blur-md transition-all ${
        selected ? "ring-2 ring-cyber-cyan shadow-neon scale-105" : "hover:border-cyber-cyan/60"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-cyber-cyan !w-3 !h-3 !border-2 !border-cyber-dark" />

      {/* Header Badge */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-[11px] font-bold tracking-wide uppercase text-slate-200 font-mono">
            {node.entityType === "VICTIM" ? "Victim Root" : node.label.slice(0, 22)}
          </span>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border ${badgeColor}`}>
          Hop {node.hopDistance}
        </span>
      </div>

      {/* Address */}
      <div className="bg-cyber-dark/90 px-2.5 py-1.5 rounded-md border border-cyber-border font-mono text-[11px] text-slate-300 truncate mb-2.5">
        {node.fullAddress}
      </div>

      {/* Balance & Inflow Details */}
      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
        <div className="bg-cyber-card/60 p-2 rounded border border-cyber-border/60">
          <div className="text-[10px] text-slate-400">Total Inflow</div>
          <div className="text-slate-100 font-bold">${node.totalInflowUsd.toLocaleString()}</div>
        </div>
        <div className="bg-cyber-card/60 p-2 rounded border border-cyber-border/60">
          <div className="text-[10px] text-slate-400">Current Bal</div>
          <div className={`font-bold ${node.balanceUsd > 0 ? "text-cyber-emerald" : "text-slate-400"}`}>
            ${node.balanceUsd.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Micro-gas / Sweep Badge if detected */}
      {node.sweepDetails?.microGasRefill && (
        <div className="mt-2.5 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-300 font-mono flex items-center justify-between">
          <span>⚡ Swept: {node.sweepDetails.sweptPercentage}%</span>
          <span className="text-amber-400 font-bold">{node.sweepDetails.exchangeName}</span>
        </div>
      )}

      {node.fiuRegistered && (
        <div className="mt-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-400 font-mono flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span>FIU-IND Registered</span>
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!bg-cyber-cyan !w-3 !h-3 !border-2 !border-cyber-dark" />
    </div>
  );
};

export const nodeTypes = {
  forensicNode: ForensicNodeComponent,
};
