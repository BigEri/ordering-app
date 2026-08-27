import type { CategoryHours } from "./categoryHours";
import { isAlwaysScheduleTimes, parseCategoryHoursMap } from "./categoryHours";

function parseStringKeyList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const k = item.trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

export type MenuOverridesPayload = {
  images: Record<string, string>;
  orderByCategory: Record<string, string[]>;
  hiddenItemIds: string[];
  hiddenCategoryKeys: string[];
  /** Klíč kategorie → denní okno. Chybějící klíč = základní nabídka (ne Pořád). */
  categoryHours: Record<string, CategoryHours>;
  /** Sekce s tlačítkem Pořád — vidět i během časového menu. */
  alwaysVisibleCategoryKeys: string[];
};

export const EMPTY_MENU_OVERRIDES: MenuOverridesPayload = {
  images: {},
  orderByCategory: {},
  hiddenItemIds: [],
  hiddenCategoryKeys: [],
  categoryHours: {},
  alwaysVisibleCategoryKeys: [],
};

export function menuOverridesFromApiJson(j: {
  images?: Record<string, string>;
  orderByCategory?: Record<string, string[]>;
  hiddenItemIds?: string[];
  hiddenCategoryKeys?: string[];
  categoryHours?: unknown;
  alwaysVisibleCategoryKeys?: unknown;
}): MenuOverridesPayload {
  const alwaysVisibleCategoryKeys = parseStringKeyList(j.alwaysVisibleCategoryKeys);
  if (j.categoryHours && typeof j.categoryHours === "object") {
    for (const [key, val] of Object.entries(j.categoryHours as Record<string, unknown>)) {
      const k = key.trim();
      if (!k || !val || typeof val !== "object") continue;
      const o = val as Record<string, unknown>;
      if (isAlwaysScheduleTimes(o.visibleFrom, o.visibleUntil) && !alwaysVisibleCategoryKeys.includes(k)) {
        alwaysVisibleCategoryKeys.push(k);
      }
    }
  }
  const alwaysSet = new Set(alwaysVisibleCategoryKeys);
  const categoryHours = parseCategoryHoursMap(j.categoryHours);
  for (const key of alwaysSet) delete categoryHours[key];
  return {
    images: j.images ?? {},
    orderByCategory: j.orderByCategory ?? {},
    hiddenItemIds: Array.isArray(j.hiddenItemIds) ? j.hiddenItemIds : [],
    hiddenCategoryKeys: Array.isArray(j.hiddenCategoryKeys) ? j.hiddenCategoryKeys : [],
    categoryHours,
    alwaysVisibleCategoryKeys,
  };
}
