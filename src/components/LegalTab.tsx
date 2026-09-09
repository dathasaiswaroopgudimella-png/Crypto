'use client';

import { useState, useRef } from "react";
import { GraphTraceResult, Section94NoticeData } from "@/lib/types";
import { BnssNoticeGenerator } from "@/lib/legal/bnss-notice";
import { FileText, Download, Copy, AlertTriangle, Shield, CheckCircle2, Lock, Scale, Printer } from "lucide-react";

interface LegalTabProps {
  traceResult: GraphTraceResult | null;
}

export default function LegalTab({ traceResult }: LegalTabProps) {
  const [notice, setNotice] = useState<Section94NoticeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const generateNotice = async () => {
    if (!traceResult) return;
    setLoading(true);
    try {
      const res = await fetch("/api/notice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trace: traceResult }),
      });
      const json = await res.json();
      if (json.success) setNotice(json.notice);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!notice) return;
    const text = BnssNoticeGenerator.formatNoticeAsText(notice);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  if (!traceResult) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        height: "60vh", gap: 14, color: "#94a3b8",
      }}>
        <FileText size={48} color="#334155" />
        <div style={{ fontSize: 16, fontWeight: 700, color: "#94a3b8" }}>No Forensic Trace Active</div>
        <div style={{ fontSize: 13, color: "#94a3b8" }}>
          Execute a trace from the Command Overview or Fund Flow Graph to generate court-admissible statutory notices.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 20, animation: "fadeIn 0.3s ease" }}>
      {/* Top Action Header */}
      <div style={{
        background: "linear-gradient(135deg, #0b1226 0%, #1a2742 100%)",
        border: "1px solid #334155",
        borderRadius: 12,
        padding: "20px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <Scale size={18} color="#0ea5e9" />
            <div style={{ fontSize: 17, fontWeight: 700, color: "#f8fafc" }}>
              Investigation-Ready Section 94 BNSS Notice Draft &amp; Section 63 BSA Certificate
            </div>
          </div>
          <div style={{ fontSize: 13, color: "#94a3b8" }}>
            Generates an investigation-ready draft statutory notice for authorized officer review and issuance under Section 94 of the Bharatiya Nagarik Suraksha Sanhita (BNSS 2023) and Section 63 of the Bharatiya Sakshya Adhiniyam (BSA 2023).
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            suppressHydrationWarning
            onClick={generateNotice}
            disabled={loading}
            style={{
              background: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)",
              border: "none",
              borderRadius: 8,
              padding: "9px 20px",
              fontSize: 12,
              fontWeight: 700,
              color: "white",
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: "0 0 16px rgba(14, 165, 233, 0.4)",
            }}
          >
            {loading ? "Forging Legal Document..." : notice ? "Regenerate Notice" : "Forge Statutory Notice"}
          </button>
        </div>
      </div>

      {/* Notice Document Viewer */}
      {notice ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Action Toolbar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#10b981" }}>
              <CheckCircle2 size={14} /> Document Forged with SHA-256 State Hash Verification Seal
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                suppressHydrationWarning
                onClick={copyToClipboard}
                style={{
                  background: "#0b1226",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  padding: "7px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: copied ? "#10b981" : "#f8fafc",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Copy size={13} /> {copied ? "Copied to Clipboard!" : "Copy Formatted Text"}
              </button>

              <button
                suppressHydrationWarning
                onClick={handlePrint}
                style={{
                  background: "#0b1226",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  padding: "7px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#38bdf8",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Printer size={13} /> Print Official Notice (PDF)
              </button>
            </div>
          </div>

          {/* Legal Document Parchment Card */}
          <div
            ref={printRef}
            style={{
              background: "#0c1322",
              border: "1.5px solid #1a2742",
              borderRadius: 12,
              padding: "36px 40px",
              color: "#e2e8f0",
              fontFamily: "Inter, sans-serif",
              lineHeight: 1.7,
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            }}
          >
            {/* Header */}
            <div style={{ textAlign: "center", borderBottom: "2px solid #334155", paddingBottom: 20, marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                INDIAN CYBER CRIME COORDINATION CENTRE (I4C) · CIS DIVISION
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                MINISTRY OF HOME AFFAIRS · GOVERNMENT OF INDIA
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc", marginTop: 12, letterSpacing: "-0.01em" }}>
                STATUTORY PRODUCTION &amp; ASSET FREEZING ORDER
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0ea5e9", marginTop: 4 }}>
                ISSUED UNDER SECTION 94 OF THE BHARATIYA NAGARIK SURAKSHA SANHITA (BNSS 2023)
              </div>
            </div>

            {/* Meta Row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24, fontSize: 12 }}>
              <div>
                <span style={{ color: "#94a3b8" }}>Notice ID:</span> <strong>{notice.noticeId}</strong><br />
                <span style={{ color: "#94a3b8" }}>Date of Issuance:</span> <strong>{notice.date}</strong><br />
                <span style={{ color: "#94a3b8" }}>CFCFRMS / 1930 Ref:</span> <strong>{notice.complaintDetails.ackNumber1930}</strong>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ color: "#94a3b8" }}>Recipient VASP:</span> <strong>{notice.vaspRecipient.name}</strong><br />
                <span style={{ color: "#94a3b8" }}>Legal Entity:</span> {notice.vaspRecipient.legalEntityName}<br />
                <span style={{ color: "#94a3b8" }}>FIU-IND Registration:</span> <strong style={{ color: "#10b981" }}>{notice.vaspRecipient.fiuNumber || "Registered"}</strong><br />
                <span style={{ color: "#94a3b8" }}>Jurisdiction:</span> {notice.vaspRecipient.jurisdiction || "Registered Reporting Entity (FIU-IND)"}<br />
                <span style={{ color: "#94a3b8" }}>Nodal Response:</span> <code style={{ fontSize: 11, color: "#38bdf8" }}>{notice.vaspRecipient.nodalOfficerEmail || notice.vaspRecipient.complianceEmail}</code>
              </div>
            </div>

            {/* Case Background & Victim Particulars */}
            <div style={{ marginBottom: 20, fontSize: 13 }}>
              <strong>1. Case Particulars &amp; Crime Ingress:</strong><br />
              A formal complaint has been registered by victim <strong>{notice.complaintDetails.victimName}</strong> regarding stolen funds amounting to <strong>₹{notice.complaintDetails.stolenAmountInr.toLocaleString("en-IN")} ({notice.complaintDetails.stolenAmountUsdt.toLocaleString()} USDT)</strong>. Initial funds were traced to suspect ingress address <code style={{ color: "#38bdf8", background: "#0b1226", padding: "2px 6px", borderRadius: 4 }}>{notice.complaintDetails.suspectInitialAddress}</code>.
              {notice.complaintDetails.bnsSections && notice.complaintDetails.bnsSections.length > 0 && (
                <div style={{ marginTop: 8, padding: "8px 12px", background: "#060b18", borderRadius: 6, border: "1px solid #1e293b", fontSize: 11, color: "#94a3b8" }}>
                  <span style={{ fontWeight: 700, color: "#cbd5e1" }}>Registered Penal Enactments (BNS 2023 / IT Act / PMLA):</span>
                  <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                    {notice.complaintDetails.bnsSections.map((sec, i) => (
                      <div key={i} style={{ color: "#38bdf8" }}>• {sec}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Forensic Attribution Path */}
            <div style={{ marginBottom: 20, fontSize: 13 }}>
              <strong>2. Automated Multi-Hop On-Chain Attribution Trail:</strong><br />
              <div style={{
                background: "#0b1226", border: "1px solid #1a2742",
                borderRadius: 8, padding: "12px 16px", marginTop: 8, fontFamily: "monospace", fontSize: 12, color: "#93c5fd",
                wordBreak: "break-all", lineHeight: 1.8,
              }}>
                {notice.forensicTrail.hopPath.join("  ──>[Hop]──>  ")}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: "#cbd5e1" }}>
                The target funds entered your exchange deposit address <code>{notice.forensicTrail.depositAddress}</code> via transaction hash <code>{notice.forensicTrail.depositTxHash}</code> and were subsequently consolidated into internal vault <code>{notice.forensicTrail.vaultSweptTo}</code>.
              </div>

              {/* Forensic Evidence Table */}
              {notice.forensicTrail.transactionEvidenceTable && notice.forensicTrail.transactionEvidenceTable.length > 0 && (
                <div style={{ marginTop: 12, overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, textAlign: "left", background: "#060b18", borderRadius: 6, border: "1px solid #1e293b" }}>
                    <thead>
                      <tr style={{ background: "#0f172a", color: "#94a3b8", borderBottom: "1px solid #334155" }}>
                        <th style={{ padding: "8px 10px" }}>Hop</th>
                        <th style={{ padding: "8px 10px" }}>Source Wallet</th>
                        <th style={{ padding: "8px 10px" }}>Destination Wallet</th>
                        <th style={{ padding: "8px 10px" }}>Amount</th>
                        <th style={{ padding: "8px 10px" }}>Network</th>
                        <th style={{ padding: "8px 10px" }}>Transaction Hash (Immutable Record)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notice.forensicTrail.transactionEvidenceTable.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #1e293b" }}>
                          <td style={{ padding: "8px 10px", fontWeight: 700, color: "#38bdf8" }}>#{row.hopIndex}</td>
                          <td style={{ padding: "8px 10px", fontFamily: "monospace", color: "#cbd5e1" }}>{row.fromAddress.slice(0, 10)}...{row.fromAddress.slice(-6)}</td>
                          <td style={{ padding: "8px 10px", fontFamily: "monospace", color: "#cbd5e1" }}>{row.toAddress.slice(0, 10)}...{row.toAddress.slice(-6)}</td>
                          <td style={{ padding: "8px 10px", fontWeight: 600, color: "#10b981" }}>{row.amountUsd.toLocaleString()} {row.tokenSymbol || "USDT"}</td>
                          <td style={{ padding: "8px 10px", color: "#94a3b8" }}>{row.network || "EVM"}</td>
                          <td style={{ padding: "8px 10px", fontFamily: "monospace", fontSize: 10, color: "#f59e0b", wordBreak: "break-all" }}>{row.txHash}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Statutory Directives */}
            <div style={{ marginBottom: 24, fontSize: 13 }}>
              <strong>3. Statutory Mandates (Mandatory Compliance within 24 Hours):</strong>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                {notice.statutoryDirectives.map((directive, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 8, fontSize: 12, color: "#cbd5e1" }}>
                    <strong style={{ color: "#0ea5e9" }}>[{idx + 1}]</strong>
                    <span>{directive}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 63 BSA Cryptographic State Seal */}
            <div style={{
              background: "rgba(14, 165, 233, 0.05)",
              border: "1px solid rgba(14, 165, 233, 0.25)",
              borderRadius: 8,
              padding: "16px",
              marginBottom: 24,
              fontSize: 12,
            }}>
              <div style={{ fontWeight: 700, color: "#38bdf8", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <Lock size={12} /> Section 63 Bharatiya Sakshya Adhiniyam (BSA 2023) Electronic Hash Certificate
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 10, color: "#94a3b8", wordBreak: "break-all" }}>
                SHA-256 State Seal: {notice.cryptographicVerification.sha256Hash}
              </div>
              <div style={{ color: "#cbd5e1", marginTop: 4, fontSize: 12 }}>
                {notice.cryptographicVerification.bsaSection63Clause}
              </div>
            </div>

            {/* Officer Sign-off */}
            <div style={{ borderTop: "1px solid #334155", paddingTop: 16, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <div>
                <strong>Investigating Officer:</strong> {notice.investigatingOfficer.name}<br />
                <strong>Rank / Role:</strong> {notice.investigatingOfficer.rank || notice.investigatingOfficer.designation}<br />
                <strong>Station &amp; Command:</strong> {notice.investigatingOfficer.policeStation} · {notice.investigatingOfficer.agency || "I4C National Command"}<br />
                <strong>Jurisdiction:</strong> {notice.investigatingOfficer.district}, {notice.investigatingOfficer.state}
              </div>
              <div style={{ textAlign: "right" }}>
                <strong>Contact Email:</strong> {notice.investigatingOfficer.contactEmail}<br />
                <strong>Helpline Ref:</strong> {notice.investigatingOfficer.contactPhone || "1930 (CFCFRMS / I4C)"}<br />
                <span style={{ color: "#94a3b8" }}>Badge / PNO:</span> <code>{notice.investigatingOfficer.officerBadgeNumber || "DL-CY-9402"}</code>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          background: "#0b1226",
          border: "1px dashed #334155",
          borderRadius: 12,
          padding: "48px 24px",
          textAlign: "center",
          color: "#94a3b8",
        }}>
          <Shield size={40} color="#0ea5e9" style={{ margin: "0 auto 12px" }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", marginBottom: 6 }}>
            Ready to Forge Section 94 BNSS Statutory Notice
          </div>
          <div style={{ fontSize: 13, color: "#94a3b8", maxWidth: 500, margin: "0 auto 18px" }}>
            Click the &quot;Forge Statutory Notice&quot; button above to populate the verified VASP compliance recipient, forensic transaction hop trail, and Section 63 BSA cryptographic state seal.
          </div>
        </div>
      )}
    </div>
  );
}
