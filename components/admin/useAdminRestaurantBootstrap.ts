"use client";

import * as React from "react";

import { postSelectActiveRestaurant } from "../../lib/admin/clientRestaurantSelect";

type RestaurantRow = { id: string; name: string };

let bootstrapInFlight: Promise<boolean> | null = null;

async function runSingleRestaurantBootstrap(): Promise<boolean> {
  if (bootstrapInFlight) return bootstrapInFlight;

  bootstrapInFlight = (async () => {
    try {
      const meR = await fetch("/api/admin/me", { cache: "no-store", credentials: "same-origin" });
      const meJ = (await meR.json()) as { ok?: boolean; activeRestaurantId?: string | null };
      if (!meR.ok || !meJ.ok || meJ.activeRestaurantId) return false;

      const rR = await fetch("/api/admin/restaurants", { cache: "no-store", credentials: "same-origin" });
      const rJ = (await rR.json()) as { ok?: boolean; restaurants?: RestaurantRow[] };
      if (!rR.ok || !rJ.ok || !rJ.restaurants || rJ.restaurants.length !== 1) return false;

      const sel = await postSelectActiveRestaurant(rJ.restaurants[0].id);
      if (!sel.ok) return false;

      window.dispatchEvent(new Event("oa-restaurant-updated"));
      return true;
    } catch {
      return false;
    } finally {
      bootstrapInFlight = null;
    }
  })();

  return bootstrapInFlight;
}

/**
 * Když chybí cookie `oa_rid` a v účtu je jen jedna provozovna, nastaví ji automaticky.
 * SUPER_ADMIN po loginu ji jinak nemá — bez toho middleware vrací z podstránek na /admin.
 */
export function useAdminRestaurantBootstrap(enabled: boolean) {
  React.useEffect(() => {
    if (!enabled) return;
    void runSingleRestaurantBootstrap();
  }, [enabled]);
}
