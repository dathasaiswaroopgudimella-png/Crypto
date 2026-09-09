export default function NotFound() {
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
        <div style={{ fontSize: 64, fontWeight: 900, color: "#06b6d4", marginBottom: 8 }}>404</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#f8fafc", marginBottom: 8 }}>
          Route Not Found
        </h1>
        <p style={{ fontSize: 14, color: "#94a3b8", marginBottom: 24 }}>
          The requested forensic endpoint does not exist in the AEGIS-TRACE system.
        </p>
        <a
          href="/"
          style={{
            padding: "10px 24px",
            background: "#06b6d4",
            color: "#0f172a",
            border: "none",
            borderRadius: 6,
            fontWeight: 700,
            textDecoration: "none",
            fontSize: 14,
          }}
        >
          Return to Command Center
        </a>
      </div>
    </div>
  );
}
