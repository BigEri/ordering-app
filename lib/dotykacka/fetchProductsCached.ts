import { unstable_cache } from "next/cache";

import type { DotykackaMenuSection } from "./dotykackaMenuSections";
import { fetchDotykackaProductsForMenu } from "./fetchProducts";
import { userFacingDotykackaMenuError } from "./fetchRetry";
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

class DotykackaMenuCacheMiss extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DotykackaMenuCacheMiss";
  }
}

/**
 * Dotykačka menu s krátkou server cache — rychlejší opakované načtení /menu na tabletu.
 * Po „Obnovit z Dotykačky“ nebo „Vynutit obnovení“ se cache zruší přes `revalidateTag`.
 * Chyby se necachují — při výpadku sítě se další požadavek znovu pokusí stáhnout menu.
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
    async (): Promise<DotykackaMenuSection[]> => {
      const result = await fetchDotykackaProductsForMenu(rid);
      if (!result.ok) {
        throw new DotykackaMenuCacheMiss(result.error);
      }
      return result.sections;
    },
    ["dotykacka-menu-v3", rid],
    { revalidate, tags: [dotykackaMenuCacheTag(rid)] },
  );

  try {
    const sections = await run();
    return { ok: true, sections };
  } catch (e) {
    const raw =
      e instanceof DotykackaMenuCacheMiss
        ? e.message
        : e instanceof Error
          ? e.message
          : "Nepodařilo se načíst produkty z Dotykačky.";
    return { ok: false, error: userFacingDotykackaMenuError(raw) };
  }
}
