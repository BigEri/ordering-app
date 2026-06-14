"use client";

import * as React from "react";

import { isKioskWebView } from "../../lib/kiosk/isKioskWebView";
import { usePosTableFields } from "../DeviceTableProvider";

import { KioskModeChooserModal } from "./KioskModeChooserModal";

type KioskStaffBackButtonProps = {
  className?: string;
  style?: React.CSSProperties;
  label?: string;
};

/** V kiosk APK jen před spárováním: volba Host / Admin (personál při setupu). */
export function KioskStaffBackButton({
  className = "chip kioskStaffBack",
  style,
  label = "← Zpět",
}: KioskStaffBackButtonProps) {
  const [kiosk, setKiosk] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const { ready, needsPairing } = usePosTableFields();

  React.useEffect(() => {
    setKiosk(isKioskWebView());
  }, []);

  if (!kiosk || !ready || !needsPairing) return null;

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
