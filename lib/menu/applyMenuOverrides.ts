import type { DotykackaMenuSection } from "../dotykacka/dotykackaMenuSections";
import type { MenuItemData } from "../../components/MenuItem";

import { menuSectionCategoryKey } from "./menuSectionKey";

/**
 * Sloučí lokální fotky z DB a vlastní pořadí položek ve skupině.
 * `orderByCategory` = mapa categoryKey → seřazené menuItemId (úplný seznam známých id v sekci).
 */
export function applyMenuOverrides(
  sections: DotykackaMenuSection[],
  images: Record<string, string>,
  orderByCategory: Record<string, string[]>,
): DotykackaMenuSection[] {
  return sections.map((sec) => {
    const catKey = menuSectionCategoryKey(sec);
    const orderedIds = orderByCategory[catKey];
    const withImages: MenuItemData[] = sec.items.map((item) => {
      const url = images[item.id];
      if (!url) return item;
      return { ...item, imageUrl: url };
    });
    if (!orderedIds?.length) {
      return { ...sec, items: withImages };
    }
    const rank = new Map<string, number>();
    orderedIds.forEach((id, i) => rank.set(id, i));
    const items = [...withImages].sort((a, b) => {
      const ra = rank.has(a.id) ? rank.get(a.id)! : 10_000;
      const rb = rank.has(b.id) ? rank.get(b.id)! : 10_000;
      return ra - rb || a.name.localeCompare(b.name, "cs");
    });
    return { ...sec, items };
  });
}
