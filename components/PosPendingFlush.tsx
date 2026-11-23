"use client";

import * as React from "react";

import { flushPendingPosQueue } from "../lib/pos/pendingPosQueue";

/** Wi-Fi může být „připojená“ i bez internetu — událost `online` pak nepřijde, proto i pravidelný pokus. */
const FLUSH_INTERVAL_MS = 15_000;

/** Po obnovení sítě zkusí odeslat frontu uložených POS požadavků. */
export function PosPendingFlush() {
  React.useEffect(() => {
    const run = () => void flushPendingPosQueue();
    window.addEventListener("online", run);
    const id = window.setInterval(run, FLUSH_INTERVAL_MS);
    void run();
    return () => {
      window.removeEventListener("online", run);
      window.clearInterval(id);
    };
  }, []);

  return null;
}
