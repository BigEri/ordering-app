import type { CategoryHours } from "./categoryHours";
import { parseCategoryHoursMap } from "./categoryHours";

export type MenuOverridesPayload = {
  images: Record<string, string>;
  orderByCategory: Record<string, string[]>;
  hiddenItemIds: string[];
  hiddenCategoryKeys: string[];
  /** Klíč kategorie → denní okno. Chybějící klíč = vidět pořád. */
  categoryHours: Record<string, CategoryHours>;
};

export const EMPTY_MENU_OVERRIDES: MenuOverridesPayload = {
  images: {},
  orderByCategory: {},
  hiddenItemIds: [],
  hiddenCategoryKeys: [],
  categoryHours: {},
};

export function menuOverridesFromApiJson(j: {
  images?: Record<string, string>;
  orderByCategory?: Record<string, string[]>;
  hiddenItemIds?: string[];
  hiddenCategoryKeys?: string[];
  categoryHours?: unknown;
}): MenuOverridesPayload {
  return {
    images: j.images ?? {},
    orderByCategory: j.orderByCategory ?? {},
    hiddenItemIds: Array.isArray(j.hiddenItemIds) ? j.hiddenItemIds : [],
    hiddenCategoryKeys: Array.isArray(j.hiddenCategoryKeys) ? j.hiddenCategoryKeys : [],
    categoryHours: parseCategoryHoursMap(j.categoryHours),
  };
}
