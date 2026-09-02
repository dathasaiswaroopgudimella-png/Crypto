'use client';

import { useState } from "react";
import { KNOWN_VASP_REGISTRY, KNOWN_HIGH_RISK_ENTITIES, KNOWN_BRIDGE_CONTRACTS } from "@/lib/constants";
import { CheckCircle2, XCircle, AlertTriangle, Search, ExternalLink, Shield, Building2, Shuffle, Mail } from "lucide-react";

export default function VaspTab() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "FIU" | "GLOBAL" | "BRIDGES" | "MIXERS">("ALL");

  const filteredVasps = KNOWN_VASP_REGISTRY.filter(v => {
    const matchesSearch = v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.legalEntity.toLowerCase().includes(search.toLowerCase()) ||
      v.jurisdiction.toLowerCase().includes(search.toLowerCase()) ||
      (v.fiuRegistrationNumber && v.fiuRegistrationNumber.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;
    if (filterType === "FIU") return v.fiuRegistered;
    if (filterType === "GLOBAL") return !v.fiuRegistered;
    return true;
  });

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 24, animation: "fadeIn 0.3s ease" }}>
      {/* Header Banner */}
      <div style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        border: "1px solid #334155",
        borderRadius: 12,
        padding: "20px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "rgba(14, 165, 233, 0.15)",
              border: "1px solid rgba(14, 165, 233, 0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Building2 size={18} color="#0ea5e9" />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#f8fafc" }}>
              VASP Compliance Intelligence &amp; FIU-IND Registry Directory
            </div>
          </div>
          <div style={{ fontSize: 13, color: "#94a3b8", maxWidth: 750, lineHeight: 1.6 }}>
            Virtual Asset Service Providers registered under the Prevention of Money Laundering Act (PMLA 2002) with India&apos;s Financial Intelligence Unit (FIU-IND). Governed by Section 94 BNSS statutory freezing mandates and 24-hour SLA response protocols.
          </div>
        </div>

        <div style={{
          background: "rgba(16, 185, 129, 0.1)",
          border: "1px solid rgba(16, 185, 129, 0.3)",
          borderRadius: 10,
          padding: "10px 18px",
          textAlign: "right",
        }}>
          <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Registered Entities</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#10b981" }}>
            {KNOWN_VASP_REGISTRY.filter(v => v.fiuRegistered).length} FIU-IND / {KNOWN_VASP_REGISTRY.length} Global
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {(["ALL", "FIU", "GLOBAL", "BRIDGES", "MIXERS"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              style={{
                background: filterType === f ? "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)" : "#0f172a",
                border: `1px solid ${filterType === f ? "#38bdf8" : "#334155"}`,
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: 12,
                fontWeight: 700,
                color: filterType === f ? "white" : "#94a3b8",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {f === "ALL" && "All Exchanges"}
              {f === "FIU" && "FIU-IND Registered"}
              {f === "GLOBAL" && "Offshore / Global"}
              {f === "BRIDGES" && "Cross-Chain Bridges"}
              {f === "MIXERS" && "Sanctioned Mixers"}
            </button>
          ))}
        </div>

        <div style={{ position: "relative", width: 320 }}>
          <Search size={14} color="#64748b" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input
            placeholder="Search exchanges, FIU numbers, or jurisdictions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%",
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: 8,
              padding: "8px 12px 8px 34px",
              fontSize: 12,
              color: "#f8fafc",
            }}
          />
        </div>
      </div>

      {/* Exchange Cards Grid */}
      {(filterType === "ALL" || filterType === "FIU" || filterType === "GLOBAL") && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          {filteredVasps.map(vasp => (
            <div
              key={vasp.name}
              style={{
                background: "#0f172a",
                border: "1px solid #1e293b",
                borderRadius: 12,
                padding: "18px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 8,
                    background: "rgba(14, 165, 233, 0.12)",
                    border: "1px solid rgba(14, 165, 233, 0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 800, color: "#38bdf8",
                  }}>
                    {vasp.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#f8fafc" }}>{vasp.name}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>{vasp.legalEntity}</div>
                  </div>
                </div>

                <div>
                  {vasp.fiuRegistered ? (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                      background: "rgba(16, 185, 129, 0.15)", color: "#34d399",
                      border: "1px solid rgba(16, 185, 129, 0.3)", display: "flex", alignItems: "center", gap: 4,
                    }}>
                      <CheckCircle2 size={12} /> FIU-IND Registered
                    </span>
                  ) : (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                      background: "rgba(245, 158, 11, 0.15)", color: "#fcd34d",
                      border: "1px solid rgba(245, 158, 11, 0.3)", display: "flex", alignItems: "center", gap: 4,
                    }}>
                      <AlertTriangle size={12} /> Offshore / Non-FIU
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, borderTop: "1px solid #1e293b", paddingTop: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>FIU Registration No.</div>
                  <div style={{ fontFamily: "monospace", fontSize: 11, color: "#10b981", fontWeight: 600 }}>
                    {vasp.fiuRegistrationNumber || "N/A (Offshore Entity)"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Jurisdiction</div>
                  <div style={{ fontSize: 11, color: "#cbd5e1" }}>{vasp.jurisdiction}</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Compliance Nodal Desk</div>
                  <div style={{ fontSize: 11, color: "#38bdf8", display: "flex", alignItems: "center", gap: 4 }}>
                    <Mail size={11} /> {vasp.complianceEmail}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>LEA Freeze Channel</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    {vasp.freezeRequestEmail || vasp.complianceEmail}
                  </div>
                </div>
              </div>

              {vasp.hotWallets.length > 0 && (
                <div style={{ borderTop: "1px solid #1e293b", paddingTop: 8 }}>
                  <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>
                    Known Hot Wallet &amp; Vault Clusters ({vasp.hotWallets.length})
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {vasp.hotWallets.slice(0, 4).map(hw => (
                      <div key={hw.address} style={{
                        background: "#0a0f1d", border: "1px solid #1e293b",
                        borderRadius: 6, padding: "3px 8px",
                        fontFamily: "monospace", fontSize: 10, color: "#cbd5e1",
                        display: "flex", alignItems: "center", gap: 6,
                      }}>
                        <span style={{ fontSize: 9, color: hw.network === "ETH" ? "#38bdf8" : hw.network === "TRON" ? "#ef4444" : "#f59e0b", fontWeight: 700 }}>
                          {hw.network}
                        </span>
                        {hw.address.slice(0, 8)}...{hw.address.slice(-4)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bridges Section */}
      {(filterType === "ALL" || filterType === "BRIDGES") && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
            Monitored Cross-Chain Bridge Routers ({KNOWN_BRIDGE_CONTRACTS.length})
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {KNOWN_BRIDGE_CONTRACTS.map(b => (
              <div key={b.address} style={{
                background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: "14px 16px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Shuffle size={14} color="#06b6d4" />
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>{b.name}</div>
                </div>
                <div style={{ fontFamily: "monospace", fontSize: 10, color: "#64748b", marginBottom: 8 }}>
                  {b.address}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>
                  Destination Ledgers: <span style={{ color: "#38bdf8", fontWeight: 600 }}>{b.destinationChains.join(", ")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sanctioned Mixers */}
      {(filterType === "ALL" || filterType === "MIXERS") && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
            Sanctioned Mixers &amp; Tumbler Routers ({KNOWN_HIGH_RISK_ENTITIES.length})
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {KNOWN_HIGH_RISK_ENTITIES.map(e => (
              <div key={e.address} style={{
                background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.25)",
                borderRadius: 10, padding: "14px 16px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <AlertTriangle size={14} color="#ef4444" />
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fca5a5" }}>{e.name}</div>
                </div>
                <div style={{ fontFamily: "monospace", fontSize: 10, color: "#64748b", marginBottom: 6 }}>
                  {e.address}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{e.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
