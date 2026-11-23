"use client";

import * as React from "react";

import type { OrderLineSnapshotInput } from "../lib/menu/orderLineLabel";
import { loadConfirmedOrdersSession, saveConfirmedOrdersSession } from "../lib/client/confirmedOrdersSession";
import { dropDeclinedStoryousOrders, TILL_BILL_ORDER_ID } from "../lib/client/storyousKioskSession";

export type ConfirmedOrderLine = {
  name: string;
  detail?: string;
  qty: number;
  unitPriceCzk: number;
  itemId?: number;
  orderId?: number;
  /** Pro zobrazení názvu v aktuálním jazyce rozhraní (ne v jazyku v době objednání). */
  snapshot?: OrderLineSnapshotInput;
};

export type ConfirmedOrder = {
  id: string;
  createdAtIso: string;
  lines: ConfirmedOrderLine[];
  totalCzk: number;
  /** Storyous delivery orderId — ať odmítnutí v kase smaže jen tohle kolo. */
  storyousOrderId?: string;
};

type OrdersContextValue = {
  orders: ConfirmedOrder[];
  /** Otevřený účet u stolu podle posledního syncu z Dotykačky. */
  hasOpenTableBill: boolean;
  /** Náhled z adminu — lokální objednávka bez Dotykačky. */
  addOrder: (order: Omit<ConfirmedOrder, "id" | "createdAtIso">) => void;
  /**
   * Přepíše seznam podle otevřeného účtu u stolu v pokladně.
   * `keepStoryousOrderIds` — kola ze Storyous, která obsluha ještě nepotvrdila (v účtu z pokladny zatím nejsou).
   */
  syncTableBillFromDotykacka: (
    bill: {
      lines: Array<{ name: string; detail?: string; qty: number; unitPriceCzk: number; itemId?: number; orderId?: number }>;
      totalCzk: number;
    },
    opts?: { keepStoryousOrderIds?: string[] },
  ) => void;
  clearOrders: () => void;
  /** Storyous: kasa objednávku odmítla — pryč z Účtu / Objednávek. */
  removeDeclinedStoryousOrder: (storyousOrderId: string) => void;
};

const OrdersContext = React.createContext<OrdersContextValue | null>(null);

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = React.useState<ConfirmedOrder[]>([]);
  const [hasOpenTableBill, setHasOpenTableBill] = React.useState(false);

  React.useEffect(() => {
    setOrders(loadConfirmedOrdersSession());
  }, []);

  const addOrder = React.useCallback((order: Omit<ConfirmedOrder, "id" | "createdAtIso">) => {
    const createdAtIso = new Date().toISOString();
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setOrders((prev) => {
      const next = [{ ...order, id, createdAtIso }, ...prev];
      saveConfirmedOrdersSession(next);
      return next;
    });
  }, []);

  const syncTableBillFromDotykacka = React.useCallback(
    (
      bill: {
        lines: Array<{ name: string; detail?: string; qty: number; unitPriceCzk: number; itemId?: number; orderId?: number }>;
        totalCzk: number;
      },
      opts?: { keepStoryousOrderIds?: string[] },
    ) => {
      if (bill.lines.length === 0) {
        setOrders([]);
        setHasOpenTableBill(false);
        saveConfirmedOrdersSession([]);
        return;
      }
      setHasOpenTableBill(true);
      const tillBill: ConfirmedOrder[] = [
        {
          id: TILL_BILL_ORDER_ID,
          createdAtIso: new Date().toISOString(),
          lines: bill.lines.map((l) => ({
            name: l.name,
            qty: l.qty,
            unitPriceCzk: l.unitPriceCzk,
            itemId: l.itemId,
            orderId: l.orderId,
            ...(l.detail ? { detail: l.detail } : {}),
          })),
          totalCzk: bill.totalCzk,
        },
      ];
      const keep = new Set(opts?.keepStoryousOrderIds ?? []);
      setOrders((prev) => {
        const pending = keep.size ? prev.filter((o) => o.storyousOrderId && keep.has(o.storyousOrderId)) : [];
        const next = [...pending, ...tillBill];
        saveConfirmedOrdersSession(next);
        return next;
      });
    },
    [],
  );

  const clearOrders = React.useCallback(() => {
    setOrders([]);
    setHasOpenTableBill(false);
    saveConfirmedOrdersSession([]);
  }, []);

  const removeDeclinedStoryousOrder = React.useCallback((storyousOrderId: string) => {
    setOrders((prev) => {
      const next = dropDeclinedStoryousOrders(prev, storyousOrderId);
      saveConfirmedOrdersSession(next);
      return next;
    });
  }, []);

  const value = React.useMemo<OrdersContextValue>(
    () => ({
      orders,
      hasOpenTableBill,
      addOrder,
      syncTableBillFromDotykacka,
      clearOrders,
      removeDeclinedStoryousOrder,
    }),
    [orders, hasOpenTableBill, addOrder, syncTableBillFromDotykacka, clearOrders, removeDeclinedStoryousOrder],
  );

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const ctx = React.useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used within OrdersProvider");
  return ctx;
}

