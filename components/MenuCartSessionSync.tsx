"use client";

import * as React from "react";

import { loadMenuCartSession, saveMenuCartSession, type MenuCartSessionScope } from "../lib/menu/menuCartSession";
import { usePosTableFields } from "./DeviceTableProvider";
import { useMenuCart } from "./MenuCartProvider";

type MenuCartSessionSyncProps = {
  restaurantId: string;
  enabled: boolean;
};

function scopeKey(scope: MenuCartSessionScope): string {
  return `${scope.restaurantId}|${scope.deviceId}|${scope.tableId}`;
}

/** Obnoví a průběžně ukládá košík do sessionStorage (přežije F5 na /menu). */
export function MenuCartSessionSync({ restaurantId, enabled }: MenuCartSessionSyncProps) {
  const { cart, setCart } = useMenuCart();
  const { deviceId, tableId, ready } = usePosTableFields();
  const appliedScopeKeyRef = React.useRef<string | null>(null);

  const scope: MenuCartSessionScope | null =
    enabled && ready && restaurantId.trim() && deviceId.trim()
      ? { restaurantId: restaurantId.trim(), deviceId: deviceId.trim(), tableId: tableId.trim() || "1" }
      : null;

  const currentScopeKey = scope ? scopeKey(scope) : null;

  React.useLayoutEffect(() => {
    if (!scope || !currentScopeKey) return;
    if (appliedScopeKeyRef.current === currentScopeKey) return;
    appliedScopeKeyRef.current = currentScopeKey;
    setCart(loadMenuCartSession(scope) ?? {});
  }, [currentScopeKey, scope, setCart]);

  React.useEffect(() => {
    if (!scope || !currentScopeKey) return;
    saveMenuCartSession(scope, cart);
  }, [cart, currentScopeKey, scope]);

  return null;
}
