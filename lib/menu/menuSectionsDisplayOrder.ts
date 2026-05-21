import type { DotykackaMenuSection } from "../dotykacka/dotykackaMenuSections";

import { applyMenuOverrides } from "./applyMenuOverrides";
import { menuSectionCategoryKey } from "./menuSectionKey";

/** Kategorie prodávané spíš jako doplněk — v překladech a na tabletu až za hlavními jídly. */
const SUPPLEMENT_CATEGORY_NAME_RE =
  /^\s*(doplňky|doplňka|doplnky|doplnek|přídavky|přídavek|prilavky|prilavek|addons?|extras?|dochucení|dochuceni)\s*$/i;

export function isSupplementMenuCategorySection(sec: DotykackaMenuSection): boolean {
  if (sec.labelKey === "other" || sec.labelKey === "all") return false;
  const name = (sec.name || "").trim();
  if (!name) return false;
  return SUPPLEMENT_CATEGORY_NAME_RE.test(name);
}

function compareSections(a: DotykackaMenuSection, b: DotykackaMenuSection): number {
  const oa = a.sortOrder ?? 0;
  const ob = b.sortOrder ?? 0;
  if (oa !== ob) return oa - ob;
  const ca = a.categoryId ?? 0;
  const cb = b.categoryId ?? 0;
  return ca - cb;
}

export type MenuSectionsDisplayOrderOptions = {
  orderByCategory?: Record<string, string[]>;
  images?: Record<string, string>;
  /** Stejné klíče jako v admin menu editoru (skryté kategorie). */
  hiddenCategoryKeys?: string[];
  hiddenItemIds?: string[];
};

/**
 * Pořadí sekcí a položek jako na tabletu: vlastní pořadí z adminu, skryté položky/kategorie pryč,
 * kategorie „Doplňky“ a podobné až na konec (před „Ostatní“).
 */
export function orderMenuSectionsLikeKiosk(
  sections: readonly DotykackaMenuSection[],
  opts: MenuSectionsDisplayOrderOptions = {},
): DotykackaMenuSection[] {
  const hiddenCat = new Set(opts.hiddenCategoryKeys ?? []);
  const hiddenItems = new Set(opts.hiddenItemIds ?? []);

  let rows = applyMenuOverrides([...sections], opts.images ?? {}, opts.orderByCategory ?? {});

  rows = rows
    .filter((sec) => !hiddenCat.has(menuSectionCategoryKey(sec)))
    .map((sec) => ({
      ...sec,
      items: sec.items.filter((it) => !hiddenItems.has(it.id)),
    }))
    .filter((sec) => sec.items.length > 0);

  const main: DotykackaMenuSection[] = [];
  const supplements: DotykackaMenuSection[] = [];
  const other: DotykackaMenuSection[] = [];

  for (const sec of rows) {
    if (sec.labelKey === "other") {
      other.push(sec);
      continue;
    }
    if (isSupplementMenuCategorySection(sec)) {
      supplements.push(sec);
    } else {
      main.push(sec);
    }
  }

  main.sort(compareSections);
  supplements.sort(compareSections);

  return [...main, ...supplements, ...other];
}
