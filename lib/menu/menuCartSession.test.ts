import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MenuCartState } from "../../components/MenuCartProvider";
import {
  clearMenuCartSession,
  loadMenuCartSession,
  MENU_CART_SESSION_STORAGE_KEY,
  parseMenuCartSessionPayload,
  saveMenuCartSession,
  type MenuCartSessionScope,
} from "./menuCartSession";

const scope: MenuCartSessionScope = {
  restaurantId: "r1",
  deviceId: "d1",
  tableId: "5",
};

const sampleCart: MenuCartState = {
  "line-1": {
    item: { id: "item-1", name: "Pizza" },
    qty: 2,
    excludedIngredients: [],
    selectedAddonIds: [],
  },
};

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

describe("menuCartSession", () => {
  beforeEach(() => {
    installSessionStorageMock();
    sessionStorage.clear();
  });

  it("round-trips cart for matching scope", () => {
    saveMenuCartSession(scope, sampleCart);
    expect(loadMenuCartSession(scope)).toEqual(sampleCart);
  });

  it("returns null when scope differs", () => {
    saveMenuCartSession(scope, sampleCart);
    expect(loadMenuCartSession({ ...scope, tableId: "9" })).toBeNull();
  });

  it("persists empty cart", () => {
    saveMenuCartSession(scope, sampleCart);
    saveMenuCartSession(scope, {});
    expect(loadMenuCartSession(scope)).toEqual({});
  });

  it("clearMenuCartSession removes stored payload", () => {
    saveMenuCartSession(scope, sampleCart);
    clearMenuCartSession();
    expect(sessionStorage.getItem(MENU_CART_SESSION_STORAGE_KEY)).toBeNull();
  });

  it("parseMenuCartSessionPayload rejects invalid json", () => {
    expect(parseMenuCartSessionPayload("{")).toBeNull();
    expect(parseMenuCartSessionPayload('{"v":2}')).toBeNull();
  });

  it("parseMenuCartSessionPayload skips invalid lines", () => {
    const payload = parseMenuCartSessionPayload(
      JSON.stringify({
        v: 1,
        scope,
        cart: {
          ok: sampleCart["line-1"],
          bad: { item: { id: "", name: "" }, qty: 0 },
        },
      }),
    );
    expect(payload?.cart.ok).toEqual(sampleCart["line-1"]);
    expect(payload?.cart.bad).toBeUndefined();
  });
});
