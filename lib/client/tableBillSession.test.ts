import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  TABLE_BILL_SESSION_STORAGE_KEY,
  clearTableBillSession,
  loadTableBillSession,
  parseTableBillSessionPayload,
  saveTableBillSession,
} from "./tableBillSession";

const scope = { deviceId: "dev-1", tableId: "5" };

function installSessionStorageMock() {
  const store = new Map<string, string>();
  const sessionStorageMock = {
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
  };
  vi.stubGlobal("sessionStorage", sessionStorageMock);
}

describe("tableBillSession", () => {
  beforeEach(() => {
    installSessionStorageMock();
    sessionStorage.clear();
  });

  it("round-trips bill snapshot for matching scope", () => {
    const bill = {
      lines: [{ name: "Řízek", qty: 1, unitPriceCzk: 189 }],
      totalCzk: 189,
    };
    saveTableBillSession(scope, bill);
    expect(loadTableBillSession(scope)).toEqual(bill);
  });

  it("rejects mismatched scope", () => {
    saveTableBillSession(scope, {
      lines: [{ name: "Cola", qty: 1, unitPriceCzk: 32 }],
      totalCzk: 32,
    });
    expect(loadTableBillSession({ deviceId: "other", tableId: "5" })).toBeNull();
  });

  it("clear removes cached bill", () => {
    saveTableBillSession(scope, {
      lines: [{ name: "Polívka", qty: 1, unitPriceCzk: 45 }],
      totalCzk: 45,
    });
    clearTableBillSession();
    expect(sessionStorage.getItem(TABLE_BILL_SESSION_STORAGE_KEY)).toBeNull();
  });

  it("parse rejects invalid payload", () => {
    expect(parseTableBillSessionPayload("{}")).toBeNull();
    expect(parseTableBillSessionPayload('{"v":1,"scope":{},"bill":{}}')).toBeNull();
  });
});
