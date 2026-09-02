'use client';

import { useState } from "react";
import { KNOWN_VASP_REGISTRY, KNOWN_HIGH_RISK_ENTITIES, KNOWN_BRIDGE_CONTRACTS, KnownVaspRecord } from "@/lib/constants";
import { CheckCircle2, XCircle, AlertTriangle, Search, ExternalLink, Shield, Building2, Shuffle, Mail, Copy, ArrowRight, X, Lock, Flame, Check } from "lucide-react";

interface VaspTabProps {
  onTraceAddress?: (address: string, network?: string) => void;
  onRequestNoticeForVasp?: (vaspName: string) => void;
}

export default function VaspTab({ onTraceAddress, onRequestNoticeForVasp }: VaspTabProps) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "FIU" | "GLOBAL" | "BRIDGES" | "MIXERS">("ALL");
  const [selectedVasp, setSelectedVasp] = useState<KnownVaspRecord | null>(null);
  const [selectedBridge, setSelectedBridge] = useState<typeof KNOWN_BRIDGE_CONTRACTS[0] | null>(null);
  const [selectedMixer, setSelectedMixer] = useState<typeof KNOWN_HIGH_RISK_ENTITIES[0] | null>(null);
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);

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

  const handleCopy = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddr(addr);
    setTimeout(() => setCopiedAddr(null), 2000);
  };

  const handleTrace = (addr: string, network?: string) => {
    if (onTraceAddress) {
      onTraceAddress(addr, network);
    }
  };

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
            Interactive intelligence directory of Virtual Asset Service Providers registered under the Prevention of Money Laundering Act (PMLA 2002) with India&apos;s Financial Intelligence Unit (FIU-IND). Click any exchange or hot wallet to inspect clusters, launch live traces, or draft statutory Section 94 BNSS production orders.
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
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onClick={() => setSelectedVasp(vasp)}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = "#0ea5e9"}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = "#1e293b"}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 8,
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
                <div style={{ borderTop: "1px solid #1e293b", paddingTop: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                      Known Hot Wallets ({vasp.hotWallets.length})
                    </div>
                    <div style={{ fontSize: 10, color: "#38bdf8", fontWeight: 600 }}>Click to Trace ➔</div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {vasp.hotWallets.slice(0, 4).map(hw => (
                      <div
                        key={hw.address}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTrace(hw.address, hw.network);
                        }}
                        style={{
                          background: "#0a0f1d",
                          border: "1px solid #1e293b",
                          borderRadius: 6,
                          padding: "4px 8px",
                          fontFamily: "monospace",
                          fontSize: 10,
                          color: "#cbd5e1",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          cursor: "pointer",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = "#38bdf8"}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = "#1e293b"}
                      >
                        <span style={{ fontSize: 9, color: hw.network === "ETH" ? "#38bdf8" : hw.network === "TRON" ? "#ef4444" : "#f59e0b", fontWeight: 700 }}>
                          {hw.network}
                        </span>
                        {hw.address.slice(0, 8)}...{hw.address.slice(-4)}
                        <ArrowRight size={10} color="#38bdf8" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #1e293b", paddingTop: 10 }}>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>Click card for Full Dossier</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#38bdf8", display: "flex", alignItems: "center", gap: 4 }}>
                  Open Exchange Dossier <ArrowRight size={13} />
                </span>
              </div>
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
              <div
                key={b.address}
                onClick={() => setSelectedBridge(b)}
                style={{
                  background: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: 10,
                  padding: "16px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = "#06b6d4"}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = "#1e293b"}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Shuffle size={14} color="#06b6d4" />
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>{b.name}</div>
                  </div>
                  <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "rgba(6,182,212,0.15)", color: "#22d3ee", fontWeight: 700 }}>
                    {b.network}
                  </span>
                </div>
                <div style={{ fontFamily: "monospace", fontSize: 10, color: "#64748b", marginBottom: 8 }}>
                  {b.address.slice(0, 14)}...{b.address.slice(-6)}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 10 }}>
                  Destinations: <span style={{ color: "#38bdf8", fontWeight: 600 }}>{b.destinationChains.join(", ")}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTrace(b.address, b.network);
                    }}
                    style={{
                      background: "rgba(6,182,212,0.15)",
                      border: "1px solid rgba(6,182,212,0.3)",
                      borderRadius: 6,
                      padding: "4px 10px",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#22d3ee",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    Trace Bridge Flows <ArrowRight size={10} />
                  </button>
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
              <div
                key={e.address}
                onClick={() => setSelectedMixer(e)}
                style={{
                  background: "rgba(239, 68, 68, 0.05)",
                  border: "1px solid rgba(239, 68, 68, 0.25)",
                  borderRadius: 10,
                  padding: "16px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(el) => el.currentTarget.style.borderColor = "#ef4444"}
                onMouseLeave={(el) => el.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.25)"}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Flame size={14} color="#ef4444" />
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fca5a5" }}>{e.name}</div>
                  </div>
                  {e.ofacSanctioned && (
                    <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "rgba(239,68,68,0.2)", color: "#fca5a5", fontWeight: 800 }}>
                      OFAC SDN
                    </span>
                  )}
                </div>
                <div style={{ fontFamily: "monospace", fontSize: 10, color: "#64748b", marginBottom: 6 }}>
                  {e.address.slice(0, 14)}...{e.address.slice(-6)}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 10 }}>{e.description}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                  <button
                    onClick={(ev) => {
                      ev.stopPropagation();
                      handleTrace(e.address, e.network);
                    }}
                    style={{
                      background: "rgba(239,68,68,0.15)",
                      border: "1px solid rgba(239,68,68,0.3)",
                      borderRadius: 6,
                      padding: "4px 10px",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#fca5a5",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    Trace Mixer Relays <ArrowRight size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interactive VASP Intelligence Dossier Modal */}
      {selectedVasp && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(10, 15, 29, 0.85)",
          backdropFilter: "blur(8px)",
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}>
          <div style={{
            background: "#0f172a",
            border: "1.5px solid #38bdf8",
            borderRadius: 16,
            width: "100%",
            maxWidth: 680,
            maxHeight: "85vh",
            overflowY: "auto",
            padding: "28px",
            boxShadow: "0 16px 48px rgba(0, 0, 0, 0.6)",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 10,
                  background: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, fontWeight: 800, color: "white",
                }}>
                  {selectedVasp.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc" }}>
                    {selectedVasp.name} Compliance Dossier
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>
                    {selectedVasp.legalEntity}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedVasp(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Compliance Status Banner */}
            <div style={{
              background: selectedVasp.fiuRegistered ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.1)",
              border: `1px solid ${selectedVasp.fiuRegistered ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
              borderRadius: 10,
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <div>
                <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Regulatory Compliance Status</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: selectedVasp.fiuRegistered ? "#34d399" : "#fcd34d" }}>
                  {selectedVasp.fiuRegistered ? "Registered Reporting Entity (FIU-IND PMLA 2002)" : "Offshore VASP (Non-FIU Registered)"}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: "#64748b" }}>FIU REGISTRATION NO.</div>
                <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#f8fafc" }}>
                  {selectedVasp.fiuRegistrationNumber || "N/A"}
                </div>
              </div>
            </div>

            {/* Contacts & Jurisdiction Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ background: "#0a0f1d", padding: "12px", borderRadius: 8, border: "1px solid #1e293b" }}>
                <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Jurisdiction / Registered Office</div>
                <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 4 }}>{selectedVasp.jurisdiction}</div>
              </div>
              <div style={{ background: "#0a0f1d", padding: "12px", borderRadius: 8, border: "1px solid #1e293b" }}>
                <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Compliance Officer / Desk</div>
                <div style={{ fontSize: 12, color: "#38bdf8", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                  <Mail size={12} /> {selectedVasp.complianceEmail}
                </div>
              </div>
            </div>

            {/* Hot Wallets Cluster List */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                Known Hot Wallet &amp; Vault Addresses ({selectedVasp.hotWallets.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 200, overflowY: "auto" }}>
                {selectedVasp.hotWallets.map(hw => (
                  <div
                    key={hw.address}
                    style={{
                      background: "#0a0f1d",
                      border: "1px solid #1e293b",
                      borderRadius: 8,
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 4,
                        background: hw.network === "ETH" ? "rgba(56,189,248,0.15)" : hw.network === "TRON" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
                        color: hw.network === "ETH" ? "#38bdf8" : hw.network === "TRON" ? "#ef4444" : "#f59e0b",
                      }}>
                        {hw.network}
                      </span>
                      <span style={{ fontFamily: "monospace", fontSize: 11, color: "#cbd5e1" }}>
                        {hw.address}
                      </span>
                      <span style={{ fontSize: 10, color: "#64748b" }}>({hw.type.replace("VASP_", "")})</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        onClick={() => handleCopy(hw.address)}
                        style={{
                          background: "transparent",
                          border: "1px solid #334155",
                          borderRadius: 6,
                          padding: "4px 8px",
                          fontSize: 10,
                          color: copiedAddr === hw.address ? "#10b981" : "#94a3b8",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        {copiedAddr === hw.address ? <Check size={10} /> : <Copy size={10} />}
                        {copiedAddr === hw.address ? "Copied" : "Copy"}
                      </button>

                      <button
                        onClick={() => {
                          setSelectedVasp(null);
                          handleTrace(hw.address, hw.network);
                        }}
                        style={{
                          background: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)",
                          border: "none",
                          borderRadius: 6,
                          padding: "4px 10px",
                          fontSize: 10,
                          fontWeight: 700,
                          color: "white",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        Trace Wallet <ArrowRight size={10} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions Footer */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #1e293b", paddingTop: 14 }}>
              <button
                onClick={() => {
                  window.location.href = `mailto:${selectedVasp.complianceEmail}?subject=URGENT:%20Statutory%20Freeze%20Order%20u/s%2094%20BNSS%202023%20-%20I4C%20Ref`;
                }}
                style={{
                  background: "#0a0f1d",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  padding: "8px 16px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#cbd5e1",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Mail size={13} /> Compose Statutory Freeze Email
              </button>

              <button
                onClick={() => {
                  if (onRequestNoticeForVasp) {
                    onRequestNoticeForVasp(selectedVasp.name);
                  }
                  setSelectedVasp(null);
                }}
                style={{
                  background: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 18px",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "white",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Shield size={13} /> Issue Section 94 Notice to {selectedVasp.name}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
