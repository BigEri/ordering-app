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
  /** Otevřený účet u stolu podle posledního syncu z Dotykačky. */
  hasOpenTableBill: boolean;
  /** Náhled z adminu — lokální objednávka bez Dotykačky. */
  addOrder: (order: Omit<ConfirmedOrder, "id" | "createdAtIso">) => void;
  /** Přepíše seznam podle otevřeného účtu u stolu v Dotyce. */
  syncTableBillFromDotykacka: (bill: { lines: Array<{ name: string; qty: number; unitPriceCzk: number }>; totalCzk: number }) => void;
  clearOrders: () => void;
};

const OrdersContext = React.createContext<OrdersContextValue | null>(null);

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = React.useState<ConfirmedOrder[]>([]);
  const [hasOpenTableBill, setHasOpenTableBill] = React.useState(false);

  const addOrder = React.useCallback((order: Omit<ConfirmedOrder, "id" | "createdAtIso">) => {
    const createdAtIso = new Date().toISOString();
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setOrders((prev) => [{ ...order, id, createdAtIso }, ...prev]);
  }, []);

  const syncTableBillFromDotykacka = React.useCallback(
    (bill: { lines: Array<{ name: string; qty: number; unitPriceCzk: number }>; totalCzk: number }) => {
      if (bill.lines.length === 0) {
        setOrders([]);
        setHasOpenTableBill(false);
        return;
      }
      setHasOpenTableBill(true);
      setOrders([
        {
          id: "dotykacka-table-bill",
          createdAtIso: new Date().toISOString(),
          lines: bill.lines.map((l) => ({
            name: l.name,
            qty: l.qty,
            unitPriceCzk: l.unitPriceCzk,
          })),
          totalCzk: bill.totalCzk,
        },
      ]);
    },
    [],
  );

  const clearOrders = React.useCallback(() => {
    setOrders([]);
    setHasOpenTableBill(false);
  }, []);

  const value = React.useMemo<OrdersContextValue>(
    () => ({ orders, hasOpenTableBill, addOrder, syncTableBillFromDotykacka, clearOrders }),
    [orders, hasOpenTableBill, addOrder, syncTableBillFromDotykacka, clearOrders],
  );

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const ctx = React.useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used within OrdersProvider");
  return ctx;
}

