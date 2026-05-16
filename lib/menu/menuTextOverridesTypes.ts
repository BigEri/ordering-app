/** Sdílené typy pro ruční texty menu (klient + server). */

export type MenuTextOverridesForLocale = {
  items: Record<string, { name?: string; description?: string }>;
  categories: Record<string, { name?: string }>;
};
