import { revalidateTag, unstable_cache } from "next/cache";

import type { DotykackaLabelPayload } from "./menuDotykackaLabels";
import { readDotykackaLabelsForRestaurantLocale } from "./menuDotykackaLabels";
import { readMenuIngredientOverridesForRestaurantLocale } from "./menuIngredientOverrides";
import type { MenuIngredientOverridesForLocale } from "../menu/menuIngredientOverridesTypes";
import type { MenuTextOverridesForLocale } from "../menu/menuTextOverridesTypes";
import { readMenuOverridesForRestaurant, EMPTY_MENU_OVERRIDES, type MenuOverridesPayload } from "./menuOverridesRead";
import { listEnabledLocaleCodes, readMenuTextOverridesForRestaurantLocale } from "./menuTextOverrides";

const DEFAULT_REVALIDATE_SEC = 120;

function cacheRevalidateSec(): number {
  const raw = process.env.MENU_OVERRIDES_CACHE_REVALIDATE_SEC;
  if (!raw) return DEFAULT_REVALIDATE_SEC;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 30 ? Math.floor(n) : DEFAULT_REVALIDATE_SEC;
}

export type MenuUiLocaleBundle = {
  text: MenuTextOverridesForLocale;
  ingredients: MenuIngredientOverridesForLocale;
  dotykacka: DotykackaLabelPayload;
};

export function menuOverridesCacheTag(restaurantId: string): string {
  return `menu-overrides-${restaurantId.trim()}`;
}

export function menuUiCacheTag(restaurantId: string): string {
  return `menu-ui-${restaurantId.trim()}`;
}

export function invalidateMenuOverridesCache(restaurantId: string): void {
  const rid = restaurantId.trim();
  if (!rid) return;
  revalidateTag(menuOverridesCacheTag(rid));
}

export function invalidateMenuUiCache(restaurantId: string): void {
  const rid = restaurantId.trim();
  if (!rid) return;
  revalidateTag(menuUiCacheTag(rid));
}

/** Fotky, pořadí, skryté položky/kategorie — cache s invalidací z adminu. */
export async function readMenuOverridesForRestaurantCached(
  restaurantId: string,
): Promise<MenuOverridesPayload> {
  const rid = restaurantId.trim();
  if (!rid) {
    return EMPTY_MENU_OVERRIDES;
  }
  const revalidate = cacheRevalidateSec();
  const run = unstable_cache(
    () => readMenuOverridesForRestaurant(rid),
    ["menu-overrides-v4", rid],
    { revalidate, tags: [menuOverridesCacheTag(rid)] },
  );
  return run();
}

/** Překlady, ingredience a Dotyka labels pro jeden jazyk. */
export async function readMenuUiBundleForLocaleCached(
  restaurantId: string,
  locale: string,
): Promise<MenuUiLocaleBundle> {
  const rid = restaurantId.trim();
  const loc = locale.trim().toLowerCase();
  const revalidate = cacheRevalidateSec();
  const run = unstable_cache(
    async (): Promise<MenuUiLocaleBundle> => {
      const [text, ingredients, dotykacka] = await Promise.all([
        readMenuTextOverridesForRestaurantLocale(rid, loc),
        readMenuIngredientOverridesForRestaurantLocale(rid, loc),
        readDotykackaLabelsForRestaurantLocale(rid, loc),
      ]);
      return { text, ingredients, dotykacka };
    },
    ["menu-ui-locale-v1", rid, loc],
    { revalidate, tags: [menuUiCacheTag(rid)] },
  );
  return run();
}

/** Všechny povolené jazyky najednou (SSR prefetch pro tablet). */
export async function readAllMenuUiBundlesForRestaurantCached(
  restaurantId: string,
): Promise<Record<string, MenuUiLocaleBundle>> {
  const codes = await listEnabledLocaleCodes();
  const useCodes = codes.length > 0 ? codes : ["cs"];
  const pairs = await Promise.all(
    useCodes.map(async (code) => [code, await readMenuUiBundleForLocaleCached(restaurantId, code)] as const),
  );
  return Object.fromEntries(pairs);
}
