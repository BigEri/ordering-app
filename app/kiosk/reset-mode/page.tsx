export const dynamic = "force-dynamic";

export default function KioskResetModePage() {
  return (
    <main style={{ maxWidth: 620, margin: "48px auto", padding: "0 20px", lineHeight: 1.55 }}>
      <h1 style={{ margin: "0 0 12px", fontSize: "1.4rem" }}>Režim byl resetován</h1>
      <p style={{ margin: 0, opacity: 0.9 }}>
        Pokud jste v Android kiosk aplikaci, měla by se teď zobrazit úvodní volba <strong>Host / Admin</strong>.
      </p>
    </main>
  );
}

