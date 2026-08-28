import { NextResponse } from "next/server";

import { fetchRestaurantMenuCached } from "../../../../lib/menu/fetchRestaurantMenu";
import {
  readAllMenuUiBundlesForRestaurantCached,
  readMenuOverridesForRestaurantCached,
} from "../../../../lib/server/menuOverridesCached";
import { resolvePublicMenuRestaurantIdSlimFromRequestUrl } from "../../../../lib/server/publicMenuRestaurantResolve";

export const dynamic = "force-dynamic";

/**
 * Na pozadí z úvodní stránky přednahřeje server cache pro `/menu` (pokladna + overrides + UI).
 * Kontext restaurace jen z device vazby / cookie — bez parametru restaurantId od klienta.
 */
export async function GET(req: Request) {
  const restaurantId = await resolvePublicMenuRestaurantIdSlimFromRequestUrl(req);
  if (!restaurantId) {
    return NextResponse.json({ ok: false, error: "No restaurant context" }, { status: 400 });
  }

  const [dotykacka, overrides, uiByLocale] = await Promise.all([
    fetchRestaurantMenuCached(restaurantId),
    readMenuOverridesForRestaurantCached(restaurantId),
    readAllMenuUiBundlesForRestaurantCached(restaurantId),
  ]);

  return NextResponse.json(
    {
      ok: true,
      restaurantId,
      dotykackaOk: dotykacka.ok,
      sectionCount: dotykacka.ok ? dotykacka.sections.length : 0,
      dotykackaError: dotykacka.ok ? undefined : dotykacka.error,
      overridesLoaded: Boolean(overrides),
      uiLocaleCount: Object.keys(uiByLocale).length,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
