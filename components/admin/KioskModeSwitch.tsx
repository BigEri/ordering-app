"use client";

import * as React from "react";

import { isKioskWebView } from "../../lib/kiosk/isKioskWebView";

import { KioskModeChooserModal } from "../kiosk/KioskModeChooserModal";
import { useAdminLanguage } from "./AdminLanguageProvider";

/** V kiosk APK na přihlášení: přepnutí mezi režimem Host a Admin. */
export function KioskModeSwitch() {
  const { t } = useAdminLanguage();
  const [kiosk, setKiosk] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    setKiosk(isKioskWebView());
  }, []);

  if (!kiosk) return null;

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
      <p style={{ margin: "0 0 10px", fontSize: 14, lineHeight: 1.45 }}>{t("admin.kiosk.adminHint")}</p>
      <button type="button" className="chip" onClick={() => setOpen(true)} style={{ cursor: "pointer" }}>
        {t("admin.kiosk.chooseMode")}
      </button>
      <KioskModeChooserModal open={open} onClose={() => setOpen(false)} />
    </section>
  );
}
