import { unstable_cache } from "next/cache";

import { fetchDotykackaProductsForMenu } from "../dotykacka/fetchProducts";
import type { DotykackaMenuSection } from "../dotykacka/dotykackaMenuSections";
import { userFacingDotykackaMenuError } from "../dotykacka/fetchRetry";
import { dotykackaMenuCacheTag } from "../dotykacka/menuCache";
import { getRestaurantStoryousRow } from "../server/restaurantStoryous";
import { fetchStoryousProductsForMenu } from "../storyous/fetchMenu";
import { getRestaurantMenuSource, type RestaurantMenuSource } from "./restaurantMenuSource";

const DEFAULT_REVALIDATE_SEC = 120;

function menuCacheRevalidateSec(): number {
  const raw = process.env.MENU_CACHE_REVALIDATE_SEC;
  if (!raw) return DEFAULT_REVALIDATE_SEC;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 30 ? Math.floor(n) : DEFAULT_REVALIDATE_SEC;
}

/** Klíč server cache — u Storyous musí obsahovat Place ID, jinak po přepnutí provozovny zůstane staré menu. */
export function restaurantMenuCacheKeyParts(
  restaurantId: string,
  source: RestaurantMenuSource,
  storyousPlaceId?: string | null,
): string[] {
  const rid = restaurantId.trim();
  if (source === "storyous") {
    return ["restaurant-menu-v2", rid, "storyous", (storyousPlaceId ?? "").trim()];
  }
  return ["restaurant-menu-v2", rid, "dotykacka"];
}

export type RestaurantMenuResult =
  | { ok: true; sections: DotykackaMenuSection[]; source: RestaurantMenuSource }
  | { ok: false; error: string; source: RestaurantMenuSource | null };

class RestaurantMenuCacheMiss extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RestaurantMenuCacheMiss";
  }
}

async function fetchRestaurantMenuUncached(rid: string): Promise<RestaurantMenuResult> {
  const source = await getRestaurantMenuSource(rid);
  if (source === "storyous") {
    const result = await fetchStoryousProductsForMenu(rid);
    if (!result.ok) return { ok: false, error: result.error, source };
    return { ok: true, sections: result.sections, source };
  }
  if (source === "dotykacka") {
    const result = await fetchDotykackaProductsForMenu(rid);
    if (!result.ok) return { ok: false, error: result.error, source };
    return { ok: true, sections: result.sections, source };
  }
  return {
    ok: false,
    source: null,
    error:
      "Pro vaši restauraci není připojená pokladna — v administraci otevřete sekci Storyous nebo Dotykačka.",
  };
}

/**
 * Menu provozovny (Storyous nebo Dotykačka) s krátkou server cache.
 * Po obnovení z adminu se cache zruší přes stejný tag jako dřív.
 */
export async function fetchRestaurantMenu(
  restaurantId: string,
): Promise<RestaurantMenuResult> {
  const rid = restaurantId.trim();
  if (!rid) {
    return { ok: false, error: "Chybí nastavení vaší restaurace.", source: null };
  }
  return fetchRestaurantMenuUncached(rid);
}

export async function fetchRestaurantMenuCached(
  restaurantId: string,
): Promise<RestaurantMenuResult> {
  const rid = restaurantId.trim();
  if (!rid) {
    return { ok: false, error: "Chybí nastavení vaší restaurace.", source: null };
  }

  const source = await getRestaurantMenuSource(rid);
  if (!source) {
    return {
      ok: false,
      source: null,
      error:
        "Pro vaši restauraci není připojená pokladna — v administraci otevřete sekci Storyous nebo Dotykačka.",
    };
  }

  const storyousPlaceId =
    source === "storyous" ? ((await getRestaurantStoryousRow(rid))?.placeId ?? "") : "";
  const revalidate = menuCacheRevalidateSec();
  const run = unstable_cache(
    async (): Promise<DotykackaMenuSection[]> => {
      const result = await fetchRestaurantMenuUncached(rid);
      if (!result.ok) throw new RestaurantMenuCacheMiss(result.error);
      return result.sections;
    },
    restaurantMenuCacheKeyParts(rid, source, storyousPlaceId),
    { revalidate, tags: [dotykackaMenuCacheTag(rid)] },
  );

  try {
    const sections = await run();
    return { ok: true, sections, source };
  } catch (e) {
    const raw =
      e instanceof RestaurantMenuCacheMiss
        ? e.message
        : e instanceof Error
          ? e.message
          : "Nepodařilo se načíst menu z pokladny.";
    if (source === "dotykacka") {
      return { ok: false, error: userFacingDotykackaMenuError(raw), source };
    }
    return { ok: false, error: raw, source };
  }
}
