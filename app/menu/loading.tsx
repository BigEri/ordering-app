export default function MenuLoading() {
  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ height: 18, width: 220, background: "rgba(255,255,255,0.06)", borderRadius: 8 }} />
      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            style={{
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16,
              overflow: "hidden",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div style={{ height: 140, background: "rgba(255,255,255,0.06)" }} />
            <div style={{ padding: 12, display: "grid", gap: 8 }}>
              <div style={{ height: 14, width: "70%", background: "rgba(255,255,255,0.06)", borderRadius: 8 }} />
              <div style={{ height: 12, width: "45%", background: "rgba(255,255,255,0.05)", borderRadius: 8 }} />
              <div style={{ height: 14, width: 80, background: "rgba(255,255,255,0.06)", borderRadius: 999 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

