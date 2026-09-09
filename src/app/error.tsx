"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "#060b18",
      color: "#f8fafc",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{
        textAlign: "center",
        padding: "40px",
        border: "1px solid #1e293b",
        borderRadius: 12,
        background: "#0b1226",
        maxWidth: 480,
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#ef4444", marginBottom: 8 }}>
          System Error
        </h1>
        <p style={{ fontSize: 14, color: "#94a3b8", marginBottom: 24 }}>
          AEGIS-TRACE encountered an unexpected condition. No forensic data has been compromised.
        </p>
        <button
          onClick={() => reset()}
          style={{
            padding: "10px 24px",
            background: "#06b6d4",
            color: "#0f172a",
            border: "none",
            borderRadius: 6,
            fontWeight: 700,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Reinitialize System
        </button>
      </div>
    </div>
  );
}
