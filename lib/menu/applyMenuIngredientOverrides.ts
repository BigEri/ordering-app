import type { DotykackaMenuSection } from "../dotykacka/dotykackaMenuSections";
import type { MenuIngredientOverridesForLocale } from "./menuIngredientOverridesTypes";

export function applyMenuIngredientOverrides(
  sections: DotykackaMenuSection[],
  overrides: MenuIngredientOverridesForLocale | null | undefined,
): DotykackaMenuSection[] {
  const map = overrides?.items ?? {};
  if (!map || Object.keys(map).length === 0) return sections;

  return sections.map((sec) => ({
    ...sec,
    items: sec.items.map((it) => {
      const list = map[it.id];
      if (!Array.isArray(list) || list.length === 0) return it;
      const ingredients = list
        .filter((l) => l && typeof l === "object" && l.hidden !== true)
        .map((l) => ({
          name: (l.label?.trim() || l.sourceName).trim(),
          allowExclude: l.allowExclude !== false,
        }))
        .filter((x) => x.name);
      return { ...it, ingredients };
    }),
  }));
}

