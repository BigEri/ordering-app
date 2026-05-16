import type { MenuItemData } from "../../components/MenuItem";

import { pickDotykackaLocalizedName } from "./dotykackaLocalizedName";

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export type DotykackaMenuSectionLabelKey = "other" | "all";

export type DotykackaMenuSection = {
  categoryId: number | null;
  /** Název z Dotyky; u syntetických sekcí prázdné + labelKey. */
  name: string;
  labelKey?: DotykackaMenuSectionLabelKey;
  sortOrder: number;
  items: MenuItemData[];
};

type CatMeta = {
  id: number;
  name: string;
  sortOrder: number;
  display: boolean;
};

/**
 * Seřadí kategorie jako v Dotyce (`sortOrder`) a přiřadí produkty.
 * Vyloučené kategorie (ingredience, skryté v Dotyce, …) už nejsou v `itemsByCategoryId` (filtrováno dříve).
 */
export function buildDotykackaMenuSections(
  itemsByCategoryId: Map<number | null, MenuItemData[]>,
  categoryRows: Record<string, unknown>[],
  excludedCategoryIds: Set<number>,
): DotykackaMenuSection[] {
  const metas: CatMeta[] = [];
  for (const row of categoryRows) {
    if (!row || typeof row !== "object") continue;
    if (row.deleted === true) continue;
    const id = num(row.id);
    if (id == null) continue;
    if (excludedCategoryIds.has(id)) continue;
    const name = pickDotykackaLocalizedName(row as Record<string, unknown>) ?? "Kategorie";
    const sortOrder = num(row.sortOrder) ?? 0;
    const display = row.display !== false;
    metas.push({ id, name, sortOrder, display });
  }
  metas.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

  const sections: DotykackaMenuSection[] = [];
  const used = new Set<number>();

  for (const c of metas) {
    if (!c.display) continue;
    const items = itemsByCategoryId.get(c.id);
    if (!items?.length) continue;
    sections.push({
      categoryId: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
      items,
    });
    used.add(c.id);
  }

  const other: MenuItemData[] = [...(itemsByCategoryId.get(null) ?? [])];
  for (const [cid, list] of itemsByCategoryId) {
    if (cid === null) continue;
    if (used.has(cid)) continue;
    other.push(...list);
  }

  if (other.length > 0) {
    sections.push({
      categoryId: null,
      name: "",
      labelKey: "other",
      sortOrder: Number.MAX_SAFE_INTEGER - 1,
      items: other,
    });
  }

  return sections;
}

/** Jedna sekce, když se kategorie nepodařilo načíst. */
export function buildFlatMenuSection(items: MenuItemData[]): DotykackaMenuSection[] {
  if (items.length === 0) return [];
  return [
    {
      categoryId: null,
      name: "",
      labelKey: "all",
      sortOrder: 0,
      items,
    },
  ];
}
