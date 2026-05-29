import type { DotykackaMenuSection } from "../dotykacka/dotykackaMenuSections";

import { menuSectionCategoryKey } from "./menuSectionKey";
import type { MenuTextOverridesForLocale } from "./menuTextOverridesTypes";

/**
 * Sloučí ruční překlady názvů/popisů položek a názvů sekcí pro daný `locale`.
 * Základ zůstává z Dotyky; přepsání z DB má přednost.
 */
export function applyMenuTextOverrides(
  sections: DotykackaMenuSection[],
  overrides: MenuTextOverridesForLocale,
): DotykackaMenuSection[] {
  return sections.map((sec) => {
    const catKey = menuSectionCategoryKey(sec);
    const catOverride = overrides.categories[catKey];
    let name = sec.name;
    if (catOverride?.name?.trim()) {
      name = catOverride.name.trim();
    }

    const items = sec.items.map((item) => {
      const o = overrides.items[item.id];
      if (!o) return item;
      const next = { ...item };
      if (o.name?.trim()) next.name = o.name.trim();
      if (o.description?.trim()) next.description = o.description.trim();
      return next;
    });

    return { ...sec, name, items };
  });
}
