"use client";

import * as React from "react";

import { flushPendingPosQueue } from "../lib/pos/pendingPosQueue";

/** Po obnovení sítě zkusí odeslat frontu uložených POS požadavků. */
export function PosPendingFlush() {
  React.useEffect(() => {
    const run = () => void flushPendingPosQueue();
    window.addEventListener("online", run);
    void run();
    return () => window.removeEventListener("online", run);
  }, []);

  return null;
}
