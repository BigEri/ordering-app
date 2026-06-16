import { afterEach, describe, expect, it, vi } from "vitest";

import {
  POS_PENDING_ORDER_RESET,
  resetPendingOrderConfirmedState,
} from "./pendingPosQueue";

describe("resetPendingOrderConfirmedState", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("dispatches POS_PENDING_ORDER_RESET after clearing queue", async () => {
    const events: string[] = [];
    const listeners = new Map<string, Set<() => void>>();
    vi.stubGlobal("window", {
      addEventListener: (type: string, handler: () => void) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(handler);
      },
      removeEventListener: (type: string, handler: () => void) => {
        listeners.get(type)?.delete(handler);
      },
      dispatchEvent: (ev: Event) => {
        events.push(ev.type);
        for (const h of listeners.get(ev.type) ?? []) h();
        return true;
      },
    });

    await resetPendingOrderConfirmedState();

    expect(events).toEqual([POS_PENDING_ORDER_RESET]);
  });
});
