import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AEGIS-TRACE | Real-Time Crypto Fraud Tracing & VASP Attribution",
  description: "Automated Evidence & Graph Intelligence System for Real-Time Crypto-Fraud Mitigation (SIH 2026 Problem Statement SIH26183 & SIH26182)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-cyber-dark text-slate-100 min-h-screen antialiased flex flex-col">
        {children}
      </body>
    </html>
  );
}
