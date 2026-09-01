"use client";

import React, { useState } from "react";
import { GraphTraceResult, Section94NoticeData } from "@/lib/types";
import { BnssNoticeGenerator } from "@/lib/legal/bnss-notice";
import { BsaCertificateGenerator } from "@/lib/legal/bsa-cert";
import { X, Printer, Download, ShieldCheck, Check } from "lucide-react";

interface NoticeModalProps {
  trace: GraphTraceResult | null;
  isOpen: boolean;
  onClose: () => void;
}

export const NoticeModal: React.FC<NoticeModalProps> = ({
  trace,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !trace) return null;

  const noticeData: Section94NoticeData = BnssNoticeGenerator.generateSection94Notice(trace);
  const bsaCert = BsaCertificateGenerator.generateBsaCertificate(
    trace.sha256StateHash,
    trace.generatedAtUtc,
    noticeData.investigatingOfficer.name
  );

  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = () => {
    const fullText = `
FORMAL STATUTORY NOTICE UNDER SECTION 94 BNSS (2023)
======================================================
Notice Reference: ${noticeData.noticeId}
Date: ${noticeData.date}

TO: Legal Compliance & Nodal Officer, ${noticeData.vaspRecipient.name}
Email: ${noticeData.vaspRecipient.complianceEmail}
FIU Registration: ${noticeData.vaspRecipient.fiuNumber}

FROM: ${noticeData.investigatingOfficer.name} (${noticeData.investigatingOfficer.designation})
${noticeData.investigatingOfficer.policeStation}

SUBJECT: MANDATORY STATUTORY FREEZING ORDER REGARDING PROCEEDS OF CRIME DEPOSITED IN WALLET: ${noticeData.forensicTrail.depositAddress}

Complaint Ack: ${noticeData.complaintDetails.ackNumber1930}
Stolen Amount: ₹${noticeData.complaintDetails.stolenAmountInr.toLocaleString()} (~$${noticeData.complaintDetails.stolenAmountUsdt} USDT)

DIRECTIVES:
1. IMMEDIATELY LOCK, FREEZE, AND SUSPEND all withdrawal, trading, P2P, and transfer privileges on deposit address: ${noticeData.forensicTrail.depositAddress}.
2. Provide certified true copies of KYC (PAN/Aadhaar/Passport, IP logs, linked bank accounts) within 24 hours.

CRYPTOGRAPHIC EVIDENCE (Section 63 BSA 2023):
SHA-256 Checksum: ${noticeData.cryptographicVerification.sha256Hash}
Extraction Timestamp: ${trace.generatedAtUtc}

${bsaCert}
    `.trim();

    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-cyber-panel border border-cyber-border rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-cyber-border flex items-center justify-between bg-cyber-card">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded bg-cyber-red/20 border border-cyber-red/40 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-cyber-red" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Section 94 BNSS Police Freezing Order & BSA §63 Certificate
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Statutory Notice Ref: {noticeData.noticeId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-cyber-border text-slate-400 hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Notice Preview Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-200 font-sans text-sm bg-[#070b14]">
          {/* Government Letterhead Header */}
          <div className="text-center border-b border-cyber-border pb-4">
            <div className="text-xs font-bold tracking-widest text-slate-400 uppercase font-mono">
              GOVERNMENT OF INDIA • MINISTRY OF HOME AFFAIRS (MHA)
            </div>
            <div className="text-sm font-bold text-white mt-1">
              INDIAN CYBER CRIME COORDINATION CENTRE (I4C) / STATE CYBER CRIME CELL
            </div>
            <div className="text-xs text-slate-400 font-mono mt-0.5">
              {noticeData.investigatingOfficer.policeStation}
            </div>
          </div>

          {/* Recipient Box */}
          <div className="bg-cyber-dark p-4 rounded-lg border border-cyber-border grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div>
              <span className="text-slate-400">TO (VASP COMPLIANCE):</span>
              <div className="text-white font-bold text-sm mt-0.5">{noticeData.vaspRecipient.name}</div>
              <div className="text-slate-300">{noticeData.vaspRecipient.legalEntityName}</div>
              <div className="text-cyber-cyan">{noticeData.vaspRecipient.complianceEmail}</div>
              <div className="text-emerald-400 mt-1">FIU Ref: {noticeData.vaspRecipient.fiuNumber}</div>
            </div>
            <div>
              <span className="text-slate-400">INVESTIGATING OFFICER:</span>
              <div className="text-white font-bold text-sm mt-0.5">{noticeData.investigatingOfficer.name}</div>
              <div className="text-slate-300">{noticeData.investigatingOfficer.designation}</div>
              <div className="text-slate-400">{noticeData.investigatingOfficer.contactPhone}</div>
              <div className="text-cyber-cyan">{noticeData.investigatingOfficer.contactEmail}</div>
            </div>
          </div>

          {/* Crime Summary */}
          <div className="border border-cyber-border rounded-lg p-4 bg-cyber-card/40 space-y-2">
            <div className="text-xs font-bold font-mono text-cyber-gold uppercase">
              Case Particulars & Ingress Point
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
              <div>
                <span className="text-slate-400">1930 Ack Number:</span>
                <p className="text-white font-bold">{noticeData.complaintDetails.ackNumber1930}</p>
              </div>
              <div>
                <span className="text-slate-400">Victim Name:</span>
                <p className="text-white font-bold">{noticeData.complaintDetails.victimName}</p>
              </div>
              <div>
                <span className="text-slate-400">Stolen Volume:</span>
                <p className="text-cyber-red font-bold">₹{noticeData.complaintDetails.stolenAmountInr.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-slate-400">USDT Equivalent:</span>
                <p className="text-cyber-cyan font-bold">${noticeData.complaintDetails.stolenAmountUsdt.toLocaleString()} USDT</p>
              </div>
            </div>
          </div>

          {/* Statutory Directives */}
          <div className="space-y-2.5">
            <div className="text-xs font-bold font-mono text-cyber-cyan uppercase">
              Statutory Directives (Section 94 BNSS 2023)
            </div>
            <div className="space-y-2 text-xs text-slate-300">
              {noticeData.statutoryDirectives.map((dir, i) => (
                <div key={i} className="flex gap-2.5 bg-cyber-card/80 p-3 rounded border border-cyber-border">
                  <span className="font-bold text-cyber-cyan font-mono">{i + 1}.</span>
                  <p className="leading-relaxed">{dir}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Cryptographic Hash Seal */}
          <div className="bg-cyber-dark p-4 rounded-lg border border-cyber-cyan/30 text-xs font-mono">
            <div className="text-cyber-cyan font-bold mb-1 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" />
              <span>Section 63 BSA (2023) Digital Admissibility Seal</span>
            </div>
            <div className="text-slate-400 break-all">
              SHA-256 Hash: <span className="text-slate-200">{noticeData.cryptographicVerification.sha256Hash}</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Block Extraction Height: {noticeData.cryptographicVerification.extractionBlockNumber} • Ledger: {trace.network}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-cyber-border bg-cyber-card flex items-center justify-between">
          <button
            onClick={handleCopyText}
            className="px-4 py-2 bg-cyber-dark hover:bg-cyber-border text-slate-300 font-mono text-xs rounded-lg border border-cyber-border flex items-center gap-1.5"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Download className="h-4 w-4" />}
            {copied ? "Notice Copied" : "Copy Plain Text Notice"}
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 hover:bg-cyber-border text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-cyber-cyan hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-neon"
            >
              <Printer className="h-4 w-4" />
              Print / Save PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
