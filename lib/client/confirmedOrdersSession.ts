import type { ConfirmedOrder } from "../../components/OrdersProvider";

export const CONFIRMED_ORDERS_SESSION_KEY = "ordering.confirmedOrders.v1";

export function loadConfirmedOrdersSession(): ConfirmedOrder[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(CONFIRMED_ORDERS_SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: ConfirmedOrder[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const o = row as Record<string, unknown>;
      if (typeof o.id !== "string" || typeof o.createdAtIso !== "string") continue;
      if (!Array.isArray(o.lines) || typeof o.totalCzk !== "number") continue;
      out.push(o as unknown as ConfirmedOrder);
    }
    return out;
  } catch {
    return [];
  }
}

export function saveConfirmedOrdersSession(orders: ConfirmedOrder[]): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(CONFIRMED_ORDERS_SESSION_KEY, JSON.stringify(orders));
  } catch {
    /* ignore */
  }
}
