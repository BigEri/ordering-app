import type { MenuCartState } from "../../components/MenuCartProvider";

export type MenuCartSessionScope = {
  restaurantId: string;
  deviceId: string;
  tableId: string;
};

type MenuCartSessionPayload = {
  v: 1;
  scope: MenuCartSessionScope;
  cart: MenuCartState;
};

export const MENU_CART_SESSION_STORAGE_KEY = "ordering.menuCart.v1";

function scopesMatch(a: MenuCartSessionScope, b: MenuCartSessionScope): boolean {
  return a.restaurantId === b.restaurantId && a.deviceId === b.deviceId && a.tableId === b.tableId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Minimální validace — odmítne poškozená data ze sessionStorage. */
export function parseMenuCartSessionPayload(raw: string): MenuCartSessionPayload | null {
  try {
    const j = JSON.parse(raw) as unknown;
    if (!isRecord(j) || j.v !== 1 || !isRecord(j.scope) || !isRecord(j.cart)) return null;
    const scope = j.scope;
    const restaurantId = typeof scope.restaurantId === "string" ? scope.restaurantId.trim() : "";
    const deviceId = typeof scope.deviceId === "string" ? scope.deviceId.trim() : "";
    const tableId = typeof scope.tableId === "string" ? scope.tableId.trim() : "";
    if (!restaurantId || !deviceId || !tableId) return null;

    const cart: MenuCartState = {};
    for (const [lineKey, lineRaw] of Object.entries(j.cart)) {
      if (!lineKey.trim() || !isRecord(lineRaw)) continue;
      const itemRaw = lineRaw.item;
      if (!isRecord(itemRaw)) continue;
      const id = typeof itemRaw.id === "string" ? itemRaw.id.trim() : "";
      const name = typeof itemRaw.name === "string" ? itemRaw.name : "";
      const qty = lineRaw.qty;
      if (!id || !name || typeof qty !== "number" || !Number.isFinite(qty) || qty <= 0) continue;
      cart[lineKey] = lineRaw as MenuCartState[string];
    }

    return {
      v: 1,
      scope: { restaurantId, deviceId, tableId },
      cart,
    };
  } catch {
    return null;
  }
}

export function loadMenuCartSession(scope: MenuCartSessionScope): MenuCartState | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(MENU_CART_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const payload = parseMenuCartSessionPayload(raw);
    if (!payload || !scopesMatch(payload.scope, scope)) return null;
    return payload.cart;
  } catch {
    return null;
  }
}

export function saveMenuCartSession(scope: MenuCartSessionScope, cart: MenuCartState): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const payload: MenuCartSessionPayload = { v: 1, scope, cart };
    sessionStorage.setItem(MENU_CART_SESSION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearMenuCartSession(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(MENU_CART_SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
