import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearKioskSplitPayContinue,
  markKioskSplitPayContinue,
  peekKioskSplitPayContinue,
  shouldResumeSplitAfterPay,
} from "./kioskSplitPay";

function installSessionStorageMock() {
  const store = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  });
}

describe("kioskSplitPay", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("resumes split when remaining items are still on the table", () => {
    expect(shouldResumeSplitAfterPay({ split: true, remaining: true })).toBe("resume");
  });

  it("goes to welcome after the last split guest", () => {
    expect(shouldResumeSplitAfterPay({ split: true, remaining: false })).toBe("welcome");
  });

  it("stays in payment when remaining is unknown", () => {
    expect(shouldResumeSplitAfterPay({ split: true, remaining: null })).toBe("resume");
  });

  it("goes to welcome for a full-table card pay", () => {
    expect(shouldResumeSplitAfterPay({ split: false, remaining: true })).toBe("welcome");
  });

  it("peek expires after the continue window", () => {
    installSessionStorageMock();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-18T20:00:00Z"));
    markKioskSplitPayContinue();
    expect(peekKioskSplitPayContinue()).toBe(true);
    vi.setSystemTime(new Date("2026-09-18T20:01:00Z"));
    expect(peekKioskSplitPayContinue()).toBe(false);
    markKioskSplitPayContinue();
    clearKioskSplitPayContinue();
    expect(peekKioskSplitPayContinue()).toBe(false);
  });
});
