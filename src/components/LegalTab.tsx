'use client';

import { useState, useRef } from "react";
import { GraphTraceResult, Section94NoticeData } from "@/lib/types";
import { FileText, Download, Copy, AlertTriangle, Shield, CheckCircle } from "lucide-react";

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
    const text = [
      `STATUTORY NOTICE UNDER SECTION 94 BNSS, 2023`,
      `Notice Reference: ${notice.noticeId}`,
      `Date: ${notice.date}`,
      ``,
      `TO: ${notice.vaspRecipient.name} (${notice.vaspRecipient.legalEntityName})`,
      `Compliance Email: ${notice.vaspRecipient.complianceEmail}`,
      ``,
      `CASE REFERENCE: ${notice.complaintDetails.ackNumber1930}`,
      `Victim: ${notice.complaintDetails.victimName}`,
      `Stolen Amount: Rs. ${notice.complaintDetails.stolenAmountInr.toLocaleString()} (${notice.complaintDetails.stolenAmountUsdt.toLocaleString()} USDT)`,
      ``,
      `FORENSIC TRAIL:`,
      notice.forensicTrail.hopPath.join(" → "),
      ``,
      `Deposit Address: ${notice.forensicTrail.depositAddress}`,
      `Transaction Hash: ${notice.forensicTrail.depositTxHash}`,
      `Amount Deposited: ${notice.forensicTrail.depositAmountUsdt.toLocaleString()} USDT`,
      `Swept To Vault: ${notice.forensicTrail.vaultSweptTo}`,
      ``,
      `STATUTORY DIRECTIVES:`,
      ...notice.statutoryDirectives.map((d, i) => `${i + 1}. ${d}`),
      ``,
      `CRYPTOGRAPHIC VERIFICATION (Section 63 BSA, 2023):`,
      `SHA-256 State Hash: ${notice.cryptographicVerification.sha256Hash}`,
      ``,
      `Issued by: ${notice.investigatingOfficer.name}`,
      `${notice.investigatingOfficer.designation}`,
      `${notice.investigatingOfficer.policeStation}`,
    ].join("\n");

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!traceResult) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 12 }}>
        <FileText size={40} color="#1e2d45" />
        <div style={{ fontSize: 16, fontWeight: 600, color: "#475569" }}>No trace loaded</div>
        <div style={{ fontSize: 13, color: "#374151" }}>Complete a forensic trace first to generate a statutory notice</div>
      </div>
    );
  }

  if (!traceResult.destinationVasp) {
    return (
      <div style={{ padding: 24 }}>
        <div className="glass-card" style={{ padding: 24, textAlign: "center", borderColor: "rgba(245,158,11,0.3)" }}>
          <AlertTriangle size={32} color="#f59e0b" style={{ margin: "0 auto 12px" }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: "#fcd34d", marginBottom: 8 }}>Destination VASP Not Yet Confirmed</div>
          <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>
            The forensic trace has identified high-risk obfuscation activity but the funds have entered a mixer contract rather than a FIU-registered exchange. Section 94 BNSS notices can only be issued to VASPs with FIU-IND registration. Consider filing for international mutual legal assistance (MLAT) or contacting OFAC for Tornado Cash attribution.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Generator panel */}
      <div className="glass-card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>
              Section 94 BNSS Statutory Freezing Notice
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              Automatically generated from forensic trace data. Addresses: {traceResult.destinationVasp.name} ({traceResult.destinationVasp.fiuNumber})
            </div>
          </div>
          <button
            onClick={generateNotice}
            disabled={loading}
            style={{
              background: loading ? "#1e2d45" : "linear-gradient(135deg, #991b1b, #dc2626)",
              border: "none", borderRadius: 8,
              padding: "10px 20px", fontSize: 13, fontWeight: 700, color: "white",
              cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <FileText size={15} />
            {loading ? "Generating..." : "Generate Notice"}
          </button>
        </div>
      </div>

      {/* Rendered notice */}
      {notice && (
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <button
              onClick={copyToClipboard}
              style={{
                background: "#111827", border: "1px solid #1e2d45",
                borderRadius: 7, padding: "7px 14px", fontSize: 12, fontWeight: 600,
                color: copied ? "#34d399" : "#94a3b8", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
              {copied ? "Copied to clipboard" : "Copy full notice"}
            </button>
            <button
              onClick={() => window.print()}
              style={{
                background: "#111827", border: "1px solid #1e2d45",
                borderRadius: 7, padding: "7px 14px", fontSize: 12, fontWeight: 600,
                color: "#94a3b8", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <Download size={13} />
              Print / Export PDF
            </button>
          </div>

          <div ref={printRef} style={{
            background: "#111827", border: "1px solid #1e2d45",
            borderRadius: 12, padding: 32, fontFamily: "Georgia, serif",
          }}>
            {/* Notice header */}
            <div style={{ textAlign: "center", marginBottom: 28, borderBottom: "2px solid #1e2d45", paddingBottom: 20 }}>
              <div style={{ fontSize: 11, letterSpacing: "0.1em", color: "#475569", marginBottom: 6 }}>GOVERNMENT OF INDIA — MINISTRY OF HOME AFFAIRS</div>
              <div style={{ fontSize: 11, letterSpacing: "0.1em", color: "#475569", marginBottom: 14 }}>INDIAN CYBER CRIME COORDINATION CENTRE (I4C)</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>
                NOTICE UNDER SECTION 94 OF BHARATIYA NAGARIK SURAKSHA SANHITA (BNSS), 2023
              </div>
              <div style={{ fontSize: 13, color: "#94a3b8" }}>Reference Number: {notice.noticeId}</div>
              <div style={{ fontSize: 13, color: "#94a3b8" }}>Date: {notice.date}</div>
            </div>

            {/* Addressed to */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>TO:</div>
              <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.8 }}>
                The Nodal Officer / Compliance Head<br />
                <strong style={{ color: "#f1f5f9" }}>{notice.vaspRecipient.name}</strong> ({notice.vaspRecipient.legalEntityName})<br />
                FIU-IND Registration: {notice.vaspRecipient.fiuNumber || "Pending Verification"}<br />
                Email: {notice.vaspRecipient.complianceEmail}
              </div>
            </div>

            {/* Case reference */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>CASE REFERENCE & COMPLAINT DETAILS</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { k: "1930 Helpline ACK Number", v: notice.complaintDetails.ackNumber1930 },
                  { k: "Date of Incident", v: notice.complaintDetails.crimeDate },
                  { k: "Victim's Name", v: notice.complaintDetails.victimName },
                  { k: "Stolen Amount", v: `Rs. ${notice.complaintDetails.stolenAmountInr.toLocaleString()} (${notice.complaintDetails.stolenAmountUsdt.toLocaleString()} USDT)` },
                  { k: "Victim's Bank Account", v: notice.complaintDetails.sourceBankOrAccount },
                  { k: "Initial Suspect Address", v: notice.complaintDetails.suspectInitialAddress },
                ].map(item => (
                  <div key={item.k} style={{ background: "#0f1629", borderRadius: 6, padding: "8px 12px" }}>
                    <div style={{ fontSize: 10, color: "#475569" }}>{item.k}</div>
                    <div style={{ fontSize: 12, color: "#f1f5f9", fontFamily: item.k.includes("Address") ? "monospace" : "inherit", marginTop: 2, wordBreak: "break-all" }}>{item.v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Forensic trail */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>CRYPTOGRAPHIC FORENSIC TRAIL</div>
              <div style={{ background: "#0f1629", borderRadius: 8, padding: 14, marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "#475569", marginBottom: 6 }}>Fund Path (Victim to Exchange Vault)</div>
                <div style={{ fontSize: 11, fontFamily: "monospace", color: "#94a3b8", lineHeight: 1.8 }}>
                  {notice.forensicTrail.hopPath.join(" →\n")}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { k: "Exchange Deposit Address", v: notice.forensicTrail.depositAddress },
                  { k: "Deposit Transaction Hash", v: notice.forensicTrail.depositTxHash },
                  { k: "Amount Deposited", v: `${notice.forensicTrail.depositAmountUsdt.toLocaleString()} USDT` },
                  { k: "Swept to Vault Address", v: notice.forensicTrail.vaultSweptTo },
                ].map(item => (
                  <div key={item.k} style={{ background: "#0f1629", borderRadius: 6, padding: "8px 12px" }}>
                    <div style={{ fontSize: 10, color: "#475569" }}>{item.k}</div>
                    <div style={{ fontSize: 11, color: "#f1f5f9", fontFamily: "monospace", marginTop: 2, wordBreak: "break-all" }}>{item.v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Directives */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", marginBottom: 10 }}>STATUTORY DIRECTIVES</div>
              {notice.statutoryDirectives.map((d, i) => (
                <div key={i} style={{
                  display: "flex", gap: 12, marginBottom: 12,
                  background: "#0f1629", borderRadius: 8, padding: 14,
                  borderLeft: "3px solid #dc2626",
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#dc2626", minWidth: 24 }}>{i + 1}.</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.7 }}>{d}</div>
                </div>
              ))}
            </div>

            {/* BSA Certificate */}
            <div style={{
              background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.2)",
              borderRadius: 8, padding: 16, marginBottom: 20,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Shield size={16} color="#10b981" />
                <div style={{ fontSize: 13, fontWeight: 700, color: "#34d399" }}>
                  Electronic Evidence Certificate — Section 63 BSA, 2023
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.7 }}>
                {notice.cryptographicVerification.bsaSection63Clause}
              </div>
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 10, color: "#475569" }}>SHA-256 State Hash</div>
                <div style={{ fontFamily: "monospace", fontSize: 11, color: "#10b981", wordBreak: "break-all", marginTop: 4 }}>
                  {notice.cryptographicVerification.sha256Hash}
                </div>
              </div>
            </div>

            {/* Signature block */}
            <div style={{ borderTop: "2px solid #1e2d45", paddingTop: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>Issued By</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.8 }}>
                    {notice.investigatingOfficer.name}<br />
                    {notice.investigatingOfficer.designation}<br />
                    {notice.investigatingOfficer.policeStation}<br />
                    {notice.investigatingOfficer.district}, {notice.investigatingOfficer.state}<br />
                    {notice.investigatingOfficer.contactEmail}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", marginBottom: 40 }}>Official Seal & Signature</div>
                  <div style={{ width: 160, height: 1, background: "#1e2d45", marginLeft: "auto" }} />
                  <div style={{ fontSize: 12, color: "#475569", marginTop: 6 }}>Authorized Investigator</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
