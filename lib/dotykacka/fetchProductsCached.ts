import { unstable_cache } from "next/cache";

import type { DotykackaMenuSection } from "./dotykackaMenuSections";
import { fetchDotykackaProductsForMenu } from "./fetchProducts";
import { dotykackaMenuCacheTag } from "./menuCache";

const DEFAULT_REVALIDATE_SEC = 120;

function menuCacheRevalidateSec(): number {
  const raw = process.env.MENU_CACHE_REVALIDATE_SEC;
  if (!raw) return DEFAULT_REVALIDATE_SEC;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 30 ? Math.floor(n) : DEFAULT_REVALIDATE_SEC;
}

type CachedMenuResult =
  | { ok: true; sections: DotykackaMenuSection[] }
  | { ok: false; error: string };

/**
 * Dotykačka menu s krátkou server cache — rychlejší opakované načtení /menu na tabletu.
 * Po „Obnovit z Dotykačky“ nebo „Vynutit obnovení“ se cache zruší přes `revalidateTag`.
 * Jinak vyprší podle revalidate (typ. 2 min, env `MENU_CACHE_REVALIDATE_SEC`).
 */
export async function fetchDotykackaProductsForMenuCached(
  restaurantId: string,
): Promise<CachedMenuResult> {
  const rid = restaurantId.trim();
  if (!rid) {
    return { ok: false, error: "Chybí nastavení vaší restaurace." };
  }

  const revalidate = menuCacheRevalidateSec();

  const run = unstable_cache(
    async (): Promise<CachedMenuResult> => {
      const result = await fetchDotykackaProductsForMenu(rid);
      if (!result.ok) return { ok: false, error: result.error };
      return { ok: true, sections: result.sections };
    },
    ["dotykacka-menu-v2", rid],
    { revalidate, tags: [dotykackaMenuCacheTag(rid)] },
  );

  return run();
}
