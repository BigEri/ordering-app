import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearKioskBillPaidByXpay,
  markKioskBillPaidByXpay,
  markKioskXpayTipMissing,
  peekKioskBillPaidByXpay,
  peekKioskXpayClose,
} from "./kioskBillClose";

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
    clear: () => {
      store.clear();
    },
  });
}

describe("kioskBillClose", () => {
  beforeEach(() => {
    installSessionStorageMock();
  });

  it("peeks a freshly marked XPay close", () => {
    expect(peekKioskBillPaidByXpay()).toBe(false);
    markKioskBillPaidByXpay();
    expect(peekKioskBillPaidByXpay()).toBe(true);
    clearKioskBillPaidByXpay();
    expect(peekKioskBillPaidByXpay()).toBe(false);
  });

  it("keeps the charged total with tip, not the open bill", () => {
    markKioskBillPaidByXpay({ amountCzk: 465, tipAmountCzk: 42 });
    markKioskBillPaidByXpay();
    expect(peekKioskXpayClose()).toMatchObject({ amountCzk: 465, tipAmountCzk: 42, tipMissing: false });
    markKioskXpayTipMissing(true);
    expect(peekKioskXpayClose()).toMatchObject({ amountCzk: 465, tipAmountCzk: 42, tipMissing: true });
  });
});
