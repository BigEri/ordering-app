"use client";

import * as React from "react";

import type { OrderLineSnapshotInput } from "../lib/menu/orderLineLabel";

export type ConfirmedOrderLine = {
  name: string;
  qty: number;
  unitPriceCzk: number;
  /** Pro zobrazení názvu v aktuálním jazyce rozhraní (ne v jazyku v době objednání). */
  snapshot?: OrderLineSnapshotInput;
};

export type ConfirmedOrder = {
  id: string;
  createdAtIso: string;
  lines: ConfirmedOrderLine[];
  totalCzk: number;
};

type OrdersContextValue = {
  orders: ConfirmedOrder[];
  addOrder: (order: Omit<ConfirmedOrder, "id" | "createdAtIso">) => void;
  clearOrders: () => void;
};

const OrdersContext = React.createContext<OrdersContextValue | null>(null);

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = React.useState<ConfirmedOrder[]>([]);

  const addOrder = React.useCallback((order: Omit<ConfirmedOrder, "id" | "createdAtIso">) => {
    const createdAtIso = new Date().toISOString();
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setOrders((prev) => [{ ...order, id, createdAtIso }, ...prev]);
  }, []);

  const clearOrders = React.useCallback(() => setOrders([]), []);

  const value = React.useMemo<OrdersContextValue>(
    () => ({ orders, addOrder, clearOrders }),
    [orders, addOrder, clearOrders],
  );

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const ctx = React.useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used within OrdersProvider");
  return ctx;
}

