"use client";

import * as React from "react";

import { tStaff } from "../lib/i18n/tStaff";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

/** Stejné na serveru i při hydrataci – předejde nesouladu stromu s `children` (page). */
function getServerOnlineSnapshot() {
  return true;
}

/** Stav `navigator.onLine` (např. zvýraznění stránky menu). */
export function useBrowserOnline() {
  return React.useSyncExternalStore(subscribe, getOnlineSnapshot, getServerOnlineSnapshot);
}

/** Upozornění pod topbarem, když prohlížeč hlásí offline. */
export function OnlineBanner() {
  const online = useBrowserOnline();

  if (online) return null;

  return (
    <div className="onlineBanner" role="alert" aria-live="assertive">
      <div className="onlineBanner__title">{tStaff("app.offline.title")}</div>
      <div className="onlineBanner__body">{tStaff("app.offline.banner")}</div>
    </div>
  );
}
