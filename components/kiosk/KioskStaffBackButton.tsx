"use client";

import * as React from "react";

import { isKioskWebView } from "../../lib/kiosk/isKioskWebView";

import { KioskModeChooserModal } from "./KioskModeChooserModal";

type KioskStaffBackButtonProps = {
  className?: string;
  style?: React.CSSProperties;
  label?: string;
};

/** V kiosk APK: návrat k volbě Host / Admin (stejný modal jako na přihlášení). */
export function KioskStaffBackButton({
  className = "chip kioskStaffBack",
  style,
  label = "← Zpět",
}: KioskStaffBackButtonProps) {
  const [kiosk, setKiosk] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    setKiosk(isKioskWebView());
  }, []);

  if (!kiosk) return null;

  return (
    <>
      <button
        type="button"
        className={className}
        style={style}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      <KioskModeChooserModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
