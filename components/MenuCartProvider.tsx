"use client";

import * as React from "react";

import type { MenuItemData } from "./MenuItem";

export type MenuCartLine = {
  item: MenuItemData;
  qty: number;
  excludedIngredients: string[];
  selectedAddonIds: string[];
  selectedSideId?: string;
  multiPickByGroupId?: Record<string, string[]>;
  savoryGlazeId?: string;
  /** Klíč skupiny Dotykačky (`dk-…`) → vybrané option id (`dkp-…`). */
  dotykackaPicks?: Record<string, string[]>;
};

export type MenuCartState = Record<string, MenuCartLine>;

type MenuCartContextValue = {
  cart: MenuCartState;
  setCart: React.Dispatch<React.SetStateAction<MenuCartState>>;
};

const MenuCartContext = React.createContext<MenuCartContextValue | null>(null);

export function MenuCartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = React.useState<MenuCartState>({});

  const value = React.useMemo<MenuCartContextValue>(() => ({ cart, setCart }), [cart]);

  return <MenuCartContext.Provider value={value}>{children}</MenuCartContext.Provider>;
}

export function useMenuCart() {
  const ctx = React.useContext(MenuCartContext);
  if (!ctx) throw new Error("useMenuCart must be used within MenuCartProvider");
  return ctx;
}
