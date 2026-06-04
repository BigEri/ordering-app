"use client";

import * as React from "react";

import { isKioskWebView } from "../../lib/kiosk/isKioskWebView";

type KioskModeSwitchProps = {
  variant?: "login" | "sidebar";
};

/** V kiosk APK: přepnutí z omylem zvoleného Admin režimu na Host + párování. */
export function KioskModeSwitch({ variant = "login" }: KioskModeSwitchProps) {
  const [kiosk, setKiosk] = React.useState(false);

  React.useEffect(() => {
    setKiosk(isKioskWebView());
  }, []);

  if (!kiosk) return null;

  const onSwitchToHost = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      /* ignore */
    }
    window.location.href = "/kiosk/reset-mode?to=host";
  };

  if (variant === "sidebar") {
    return (
      <button type="button" className="chip adminShell__kioskHost" onClick={() => void onSwitchToHost()}>
        Režim host (menu)
      </button>
    );
  }

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
      <button type="button" className="chip" onClick={() => void onSwitchToHost()} style={{ cursor: "pointer" }}>
        Přepnout na host → párování / menu
      </button>
    </section>
  );
}
