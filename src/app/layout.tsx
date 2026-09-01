import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AEGIS-TRACE — Cryptocurrency Forensic Intelligence System",
  description: "Real-time multi-chain cryptocurrency fraud investigation and VASP attribution platform for I4C / MHA. Smart India Hackathon 2026 — PS SIH26183.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ minHeight: "100vh", background: "#0a0e1a" }}>
        {children}
      </body>
    </html>
  );
}
