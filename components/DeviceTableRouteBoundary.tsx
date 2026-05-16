"use client";

import * as React from "react";

import { DeviceTableProvider } from "./DeviceTableProvider";

/** Oddělený client boundary pro routy s menu — zajistí stejný React kontext jako `usePosTableFields` (Turbopack / split chunks). */
export function DeviceTableRouteBoundary({ children }: { children: React.ReactNode }) {
  return <DeviceTableProvider>{children}</DeviceTableProvider>;
}
