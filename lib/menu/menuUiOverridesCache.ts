import type { MenuIngredientOverridesForLocale } from "./menuIngredientOverridesTypes";
import type { MenuTextOverridesForLocale } from "./menuTextOverridesTypes";

export type MenuUiOverridesBundle = {
  text: MenuTextOverridesForLocale;
  ingredients: MenuIngredientOverridesForLocale;
  dotykacka: { groups: Record<string, string>; options: Record<string, string> };
};

type UiOverridesApiJson = {
  ok?: boolean;
  text?: MenuTextOverridesForLocale;
  ingredients?: MenuIngredientOverridesForLocale;
  dotykacka?: { groups?: Record<string, string>; options?: Record<string, string> };
};

let cacheRestaurantId: string | null = null;
const cacheByLocale = new Map<string, MenuUiOverridesBundle>();
const inflightByLocale = new Map<string, Promise<MenuUiOverridesBundle | null>>();

function normLocale(locale: string): string {
  const lc = locale.trim().toLowerCase();
  return lc === "en" || lc === "ko" || lc === "cs" ? lc : "cs";
}

function parseBundle(j: UiOverridesApiJson): MenuUiOverridesBundle {
  return {
    text: {
      items: j.text?.items ?? {},
      categories: j.text?.categories ?? {},
    },
    ingredients: { items: j.ingredients?.items ?? {} },
    dotykacka: {
      groups: j.dotykacka?.groups ?? {},
      options: j.dotykacka?.options ?? {},
    },
  };
}

export function resetMenuUiOverridesCache(restaurantId?: string | null): void {
  cacheRestaurantId = restaurantId?.trim() || null;
  cacheByLocale.clear();
  inflightByLocale.clear();
}

export function getMenuUiOverridesFromCache(locale: string): MenuUiOverridesBundle | null {
  return cacheByLocale.get(normLocale(locale)) ?? null;
}

export function putMenuUiOverridesInCache(locale: string, bundle: MenuUiOverridesBundle): void {
  cacheByLocale.set(normLocale(locale), bundle);
}

/** SSR data pro aktivní jazyk — bez dalšího requestu na první paint. */
export function seedMenuUiOverridesCache(
  restaurantId: string,
  locale: string,
  bundle: MenuUiOverridesBundle,
): void {
  const rid = restaurantId.trim();
  if (!rid) return;
  if (cacheRestaurantId !== rid) {
    resetMenuUiOverridesCache(rid);
  }
  putMenuUiOverridesInCache(locale, bundle);
}

/** SSR: přednačte všechny jazyky do paměti klienta. */
export function seedAllMenuUiOverridesCache(
  restaurantId: string,
  byLocale: Record<string, MenuUiOverridesBundle>,
): void {
  const rid = restaurantId.trim();
  if (!rid) return;
  resetMenuUiOverridesCache(rid);
  for (const [locale, bundle] of Object.entries(byLocale)) {
    putMenuUiOverridesInCache(locale, bundle);
  }
}

async function fetchMenuUiOverridesOnce(locale: string): Promise<MenuUiOverridesBundle | null> {
  const loc = normLocale(locale);
  try {
    const r = await fetch(`/api/menu/ui-overrides?locale=${encodeURIComponent(loc)}`);
    const j = (await r.json()) as UiOverridesApiJson;
    if (!r.ok || !j.ok) return null;
    const bundle = parseBundle(j);
    putMenuUiOverridesInCache(loc, bundle);
    return bundle;
  } catch {
    return null;
  }
}

/** Načte překlady menu — paměť, pak HTTP (browser cache dle Cache-Control API). */
export function loadMenuUiOverrides(locale: string): Promise<MenuUiOverridesBundle | null> {
  const loc = normLocale(locale);
  const hit = cacheByLocale.get(loc);
  if (hit) return Promise.resolve(hit);

  const pending = inflightByLocale.get(loc);
  if (pending) return pending;

  const run = fetchMenuUiOverridesOnce(loc).finally(() => {
    inflightByLocale.delete(loc);
  });
  inflightByLocale.set(loc, run);
  return run;
}

/** Na pozadí přednačte ostatní jazyky pro rychlé přepínání vlajky. */
export function prefetchMenuUiOverrides(locales: readonly string[]): void {
  for (const raw of locales) {
    const loc = normLocale(raw);
    if (cacheByLocale.has(loc) || inflightByLocale.has(loc)) continue;
    void loadMenuUiOverrides(loc);
  }
}
