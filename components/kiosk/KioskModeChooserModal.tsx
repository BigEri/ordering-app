"use client";

import * as React from "react";

import { navigateToKioskMode } from "../../lib/kiosk/modeSwitch";
import { useAdminLanguage } from "../admin/AdminLanguageProvider";

type KioskModeChooserModalProps = {
  open: boolean;
  onClose: () => void;
};

export function KioskModeChooserModal({ open, onClose }: KioskModeChooserModalProps) {
  const { t } = useAdminLanguage();
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

  const choose = React.useCallback(
    async (target: "host" | "admin") => {
      if (target === "host") {
        const ok = window.confirm(t("admin.kiosk.hostConfirm"));
        if (!ok) return;
      }
      setSwitching(target);
      try {
        await navigateToKioskMode(target);
      } catch {
        setSwitching(null);
      }
    },
    [t],
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("admin.kiosk.modalAria")}
      onClick={() => {
        if (switching === null) onClose();
      }}
      className="modalOverlay modalOverlay--60"
    >
      <div onClick={(e) => e.stopPropagation()} className="modalCard">
        <strong className="modalTitle">{t("admin.kiosk.modalTitle")}</strong>
        <p className="textMuted" style={{ margin: "0 0 16px", lineHeight: 1.55 }}>
          <strong>{t("admin.kiosk.modalHostLead")}</strong> — {t("admin.kiosk.modalHostBody")}
          <br />
          <strong>{t("admin.kiosk.modalAdminLead")}</strong> — {t("admin.kiosk.modalAdminBody")}
        </p>
        <div style={{ display: "grid", gap: 8 }}>
          <button
            type="button"
            className="btnPrimary"
            disabled={switching !== null}
            onClick={() => void choose("host")}
            style={{ cursor: switching !== null ? "wait" : "pointer", width: "100%" }}
          >
            {switching === "host" ? "…" : t("admin.kiosk.hostBtn")}
          </button>
          <button
            type="button"
            className="chip"
            disabled={switching !== null}
            onClick={() => void choose("admin")}
            style={{ cursor: switching !== null ? "wait" : "pointer", width: "100%" }}
          >
            {switching === "admin" ? "…" : t("admin.kiosk.adminBtn")}
          </button>
          <button
            type="button"
            className="chip"
            disabled={switching !== null}
            onClick={onClose}
            style={{ cursor: switching !== null ? "wait" : "pointer", width: "100%" }}
          >
            {t("admin.kiosk.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
