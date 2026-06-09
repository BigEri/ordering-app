"use client";

import { usePathname } from "next/navigation";
import * as React from "react";

import { isAdminMenuPreviewOnClient } from "../lib/admin/publicMenuPreviewUrl";
import { buildKioskWelcomeUrl, kioskNavigate } from "../lib/kiosk/nav";

/** Po této době bez interakce na `/menu` přesměrování na úvodní stránku (2 min 30 s). */
export const MENU_IDLE_REDIRECT_MS = 150_000;

/**
 * Kiosk / tablet: návrat na `/` po nečinnosti (klik, scroll, kolečko, klávesa, tah prstem).
 * Na jiné kartě se odpočet pozastaví.
 */
export function useMenuIdleRedirect() {
  const pathname = usePathname() ?? "";
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = React.useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const schedule = React.useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      kioskNavigate(buildKioskWelcomeUrl());
    }, MENU_IDLE_REDIRECT_MS);
  }, [clearTimer]);

  React.useEffect(() => {
    if (pathname.startsWith("/admin") || isAdminMenuPreviewOnClient()) {
      clearTimer();
      return;
    }

    schedule();

    const bump = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      schedule();
    };

    const capture: AddEventListenerOptions = { capture: true, passive: true };

    window.addEventListener("scroll", bump, capture);
    window.addEventListener("wheel", bump, capture);
    window.addEventListener("touchmove", bump, capture);
    window.addEventListener("pointerdown", bump, capture);
    window.addEventListener("keydown", bump, capture);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") clearTimer();
      else schedule();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearTimer();
      window.removeEventListener("scroll", bump, capture);
      window.removeEventListener("wheel", bump, capture);
      window.removeEventListener("touchmove", bump, capture);
      window.removeEventListener("pointerdown", bump, capture);
      window.removeEventListener("keydown", bump, capture);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pathname, schedule, clearTimer]);
}
