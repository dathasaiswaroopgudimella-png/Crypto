'use client';

import { useState } from "react";
import { KNOWN_VASP_REGISTRY, KNOWN_HIGH_RISK_ENTITIES } from "@/lib/constants";
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";

export default function VaspTab() {
  const [search, setSearch] = useState("");
  const filtered = KNOWN_VASP_REGISTRY.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.jurisdiction.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
          FIU-IND Registered VASP Intelligence Directory
        </div>
        <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 16, lineHeight: 1.6 }}>
          The following exchanges are registered with India's Financial Intelligence Unit (FIU-IND) under the Prevention of Money Laundering Act (PMLA) and are obligated to respond to Section 94 BNSS statutory notices within twenty-four hours. A Section 94 notice served to any of these entities compels immediate account freezing and KYC disclosure.
        </div>
        <input
          placeholder="Search exchanges or jurisdictions..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: 320, background: "#111827", border: "1px solid #1e2d45",
            borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#f1f5f9", marginBottom: 16,
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(vasp => (
            <div key={vasp.name} className="glass-card" style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 8,
                    background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 800, color: "#60a5fa",
                  }}>
                    {vasp.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{vasp.name}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>{vasp.legalEntity}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {vasp.fiuRegistered ? (
                    <span className="badge-fiu" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <CheckCircle size={10} /> FIU Registered
                    </span>
                  ) : (
                    <span className="badge-critical" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <XCircle size={10} /> Not FIU Registered
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, borderTop: "1px solid #1e2d45", paddingTop: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#475569", marginBottom: 4 }}>FIU Registration Number</div>
                  <div style={{ fontFamily: "monospace", fontSize: 11, color: "#34d399" }}>
                    {vasp.fiuRegistrationNumber || "Not Registered"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#475569", marginBottom: 4 }}>Jurisdiction</div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>{vasp.jurisdiction}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#475569", marginBottom: 4 }}>Section 94 Notice Email</div>
                  <div style={{ fontSize: 12, color: "#60a5fa" }}>{vasp.complianceEmail}</div>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, color: "#475569", marginBottom: 6 }}>Known Hot Wallet Addresses</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {vasp.hotWallets.map(hw => (
                    <div key={hw.address} style={{
                      background: "#111827", border: "1px solid #1e2d45",
                      borderRadius: 6, padding: "4px 10px",
                      fontFamily: "monospace", fontSize: 10, color: "#94a3b8",
                      display: "flex", alignItems: "center", gap: 6,
                    }}>
                      <span style={{ fontSize: 9, color: hw.network === "ETH" ? "#60a5fa" : hw.network === "TRON" ? "#ef4444" : "#f59e0b", fontWeight: 700 }}>
                        {hw.network}
                      </span>
                      {hw.address.slice(0, 12)}...{hw.address.slice(-6)}
                      <span style={{ fontSize: 9, color: "#475569" }}>{hw.type.replace("VASP_", "")}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* High Risk Entities */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
          High Risk & OFAC-Sanctioned Entities
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {KNOWN_HIGH_RISK_ENTITIES.map(e => (
            <div key={e.address} style={{
              background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.2)",
              borderRadius: 10, padding: "14px 18px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <AlertTriangle size={16} color="#a78bfa" />
                <div style={{ fontSize: 14, fontWeight: 700, color: "#c4b5fd" }}>{e.name}</div>
                {e.ofacSanctioned && (
                  <span className="badge-critical">OFAC Sanctioned</span>
                )}
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 11, color: "#475569", marginBottom: 6 }}>{e.address}</div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>{e.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
