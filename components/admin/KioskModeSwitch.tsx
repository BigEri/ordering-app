"use client";

import * as React from "react";

import { isKioskWebView } from "../../lib/kiosk/isKioskWebView";

/** V kiosk APK na přihlášení: přepnutí z omylem zvoleného Admin režimu na Host + párování. */
export function KioskModeSwitch() {
  const [kiosk, setKiosk] = React.useState(false);
  const [switching, setSwitching] = React.useState(false);

  React.useEffect(() => {
    setKiosk(isKioskWebView());
  }, []);

  if (!kiosk) return null;

  const onSwitchToHost = async () => {
    setSwitching(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      /* ignore */
    }
    window.location.href = "/kiosk/reset-mode?to=host";
  };

  return (
    <section
      className="adminKioskModeSwitch"
      style={{
        marginTop: 24,
        padding: 14,
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "var(--panel)",
      }}
    >
      <p style={{ margin: "0 0 10px", fontSize: 14, lineHeight: 1.45 }}>
        Tablet je v režimu <strong>Admin</strong>. Pro hosty a objednávání přepněte na režim kiosk (host).
      </p>
      <button
        type="button"
        className="chip"
        disabled={switching}
        onClick={() => void onSwitchToHost()}
        style={{ cursor: switching ? "wait" : "pointer" }}
      >
        {switching ? "…" : "Přepnout na host → párování / menu"}
      </button>
    </section>
  );
}
