"use client";

import { usePathname } from "next/navigation";
import * as React from "react";

import { isAdminMenuPreviewOnClient } from "../lib/admin/publicMenuPreviewUrl";
import { getMenuIdleRedirectMs, MENU_IDLE_REDIRECT_MS_DEFAULT } from "../lib/kiosk/menuIdleRedirect";
import { buildKioskWelcomeUrl, kioskNavigate } from "../lib/kiosk/nav";

/** @deprecated Prefer `getMenuIdleRedirectMs()` — hodnota respektuje env override. */
export const MENU_IDLE_REDIRECT_MS = MENU_IDLE_REDIRECT_MS_DEFAULT;

type UseMenuIdleRedirectOptions = {
  /** Pozastaví odpočet (např. neprázdný košík). */
  pause?: boolean;
};

/**
 * Kiosk / tablet: návrat na `/` po nečinnosti (klik, scroll, kolečko, klávesa, tah prstem).
 * Na jiné kartě se odpočet pozastaví.
 */
export function useMenuIdleRedirect(opts?: UseMenuIdleRedirectOptions) {
  const pause = opts?.pause ?? false;
  const pathname = usePathname() ?? "";
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pauseRef = React.useRef(pause);
  pauseRef.current = pause;

  const clearTimer = React.useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const idleMs = React.useMemo(() => getMenuIdleRedirectMs(), []);

  const schedule = React.useCallback(() => {
    clearTimer();
    if (pauseRef.current) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      kioskNavigate(buildKioskWelcomeUrl());
    }, idleMs);
  }, [clearTimer, idleMs]);

  React.useEffect(() => {
    if (pause) clearTimer();
    else schedule();
  }, [pause, clearTimer, schedule]);

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
