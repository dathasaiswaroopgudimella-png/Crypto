"use client";

import React from "react";
import { KNOWN_VASP_REGISTRY, KNOWN_HIGH_RISK_ENTITIES } from "@/lib/constants";
import { Building2, ShieldCheck, Mail, AlertTriangle, ExternalLink } from "lucide-react";

export const VaspDirectoryTab: React.FC = () => {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto h-full text-slate-100">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <h1 className="text-xl font-black text-white">Known VASP & Exchange Directory</h1>
        <p className="text-xs text-slate-400">
          Pre-indexed hot and cold wallet vault addresses for FIU-IND registered cryptocurrency exchanges operating in India
        </p>
      </div>

      {/* VASP Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {KNOWN_VASP_REGISTRY.map((vasp) => (
          <div key={vasp.name} className="bg-surface-card border border-border rounded-xl p-5 shadow-card space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-surface-high border border-border flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-brand-cyan" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{vasp.name}</h3>
                  <span className="text-[10px] text-slate-400">{vasp.legalEntity}</span>
                </div>
              </div>

              {vasp.fiuRegistered && (
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-brand-emerald/15 text-brand-emerald border border-brand-emerald/30">
                  FIU-IND
                </span>
              )}
            </div>

            <div className="text-xs space-y-1.5 font-mono">
              <div className="text-slate-400">
                FIU Ref: <span className="text-slate-200">{vasp.fiuRegistrationNumber || "Verified"}</span>
              </div>
              <div className="flex items-center gap-1.5 text-brand-cyan truncate">
                <Mail className="h-3.5 w-3.5" />
                <span>{vasp.complianceEmail}</span>
              </div>
            </div>

            <div className="border-t border-border-subtle pt-2.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                Indexed Vault Wallets ({vasp.hotWallets.length})
              </span>
              <div className="space-y-1 font-mono text-[11px]">
                {vasp.hotWallets.map((w, i) => (
                  <div key={i} className="bg-surface-low px-2 py-1 rounded border border-border-subtle flex items-center justify-between">
                    <span className="text-slate-300 truncate max-w-[180px]">{w.address}</span>
                    <span className="text-[10px] text-brand-amber font-semibold">{w.network}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* High-Risk Entities Section */}
      <div className="bg-surface-card border border-border rounded-xl p-5 shadow-card space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-brand-red" />
          <span>High-Risk Obfuscation & Mixer Contracts</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
          {KNOWN_HIGH_RISK_ENTITIES.map((ent, i) => (
            <div key={i} className="bg-surface-low p-3 rounded-lg border border-brand-red/30 space-y-1">
              <div className="text-brand-red font-bold">{ent.name}</div>
              <div className="text-slate-400 truncate">{ent.address}</div>
              <span className="text-[10px] text-brand-amber font-semibold block">{ent.network} • OFAC Flagged</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
