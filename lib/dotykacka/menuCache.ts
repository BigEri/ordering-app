import { revalidateTag } from "next/cache";

/** Stejný tag jako v `fetchDotykackaProductsForMenuCached`. */
export function dotykackaMenuCacheTag(restaurantId: string): string {
  return `menu-products-${restaurantId.trim()}`;
}

/** Zruší server cache menu z Dotykačky — další načtení /menu stáhne aktuální data. */
export function invalidateDotykackaMenuCache(restaurantId: string): void {
  const rid = restaurantId.trim();
  if (!rid) return;
  revalidateTag(dotykackaMenuCacheTag(rid));
}
