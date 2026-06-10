"use client";

import * as React from "react";

import { navigateToKioskMode } from "../../lib/kiosk/modeSwitch";

type KioskModeChooserModalProps = {
  open: boolean;
  onClose: () => void;
};

export function KioskModeChooserModal({ open, onClose }: KioskModeChooserModalProps) {
  const [switching, setSwitching] = React.useState<"host" | "admin" | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && switching === null) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, switching]);

  React.useEffect(() => {
    if (!open) setSwitching(null);
  }, [open]);

  const choose = React.useCallback(async (target: "host" | "admin") => {
    setSwitching(target);
    try {
      await navigateToKioskMode(target);
    } catch {
      setSwitching(null);
    }
  }, []);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Zvolte režim tabletu"
      onClick={() => {
        if (switching === null) onClose();
      }}
      className="modalOverlay modalOverlay--60"
    >
      <div onClick={(e) => e.stopPropagation()} className="modalCard">
        <strong className="modalTitle">Zvolte režim tabletu</strong>
        <p className="textMuted" style={{ margin: "0 0 16px", lineHeight: 1.55 }}>
          <strong>Host (kiosk)</strong> — úvodní stránka a objednávání pro hosty u stolu.
          <br />
          <strong>Admin</strong> — přihlášení do správy restaurace.
        </p>
        <div style={{ display: "grid", gap: 8 }}>
          <button
            type="button"
            className="btnPrimary"
            disabled={switching !== null}
            onClick={() => void choose("host")}
            style={{ cursor: switching !== null ? "wait" : "pointer", width: "100%" }}
          >
            {switching === "host" ? "…" : "Host (kiosk)"}
          </button>
          <button
            type="button"
            className="chip"
            disabled={switching !== null}
            onClick={() => void choose("admin")}
            style={{ cursor: switching !== null ? "wait" : "pointer", width: "100%" }}
          >
            {switching === "admin" ? "…" : "Admin — přihlášení"}
          </button>
          <button
            type="button"
            className="chip"
            disabled={switching !== null}
            onClick={onClose}
            style={{ cursor: switching !== null ? "wait" : "pointer", width: "100%" }}
          >
            Zrušit
          </button>
        </div>
      </div>
    </div>
  );
}
