export type MenuIngredientOverrideLine = {
  /** Stabilní klíč — původní název ingredience (z Dotyky / cs), nebo vlastní. */
  sourceName: string;
  /** Text zobrazený hostovi v daném jazyce. */
  label: string;
  /** true = lze odebrat v modalu (checkbox). */
  allowExclude: boolean;
  /** true = nezobrazovat v detailu (ani v modal výběru). */
  hidden?: boolean;
};

export type MenuIngredientOverridesForLocale = {
  /** menuItemId → seznam ingrediencí (autoritatívní pro daný item+locale) */
  items: Record<string, MenuIngredientOverrideLine[]>;
};

