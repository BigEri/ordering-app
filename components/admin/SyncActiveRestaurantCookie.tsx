"use client";

import * as React from "react";

/** Sync active restaurant cookie to URL restaurant (same as restaurant detail). */
export function SyncActiveRestaurantCookie({ restaurantId }: { restaurantId: string }) {
  React.useEffect(() => {
    const id = restaurantId.trim();
    if (!id) return;
    let cancelled = false;
    void (async () => {
      try {
        const meR = await fetch("/api/admin/me", { cache: "no-store", credentials: "same-origin" });
        const meJ = (await meR.json()) as { ok?: boolean; activeRestaurantId?: string | null };
        if (cancelled || !meR.ok || !meJ.ok) return;
        if (meJ.activeRestaurantId === id) return;
        const r = await fetch("/api/admin/restaurant/select", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ restaurantId: id }),
          credentials: "same-origin",
        });
        const j = (await r.json()) as { ok?: boolean };
        if (!cancelled && r.ok && j.ok) {
          window.dispatchEvent(new Event("oa-restaurant-updated"));
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);
  return null;
}
