import type { MenuItemData } from "../../components/MenuItem";

/** Složený klíč řádku košíku — stejný produkt, jiné úpravy / bez ingrediencí = jiný řádek. */
export function makeMenuCartLineKey(
  itemId: string,
  picks: Record<string, string[]> | undefined,
  excludedIngredients?: string[],
): string {
  const keys = picks && Object.keys(picks).length > 0 ? Object.keys(picks).sort() : [];
  const flat =
    keys.length > 0
      ? keys.map((k) => `${k}:${[...(picks![k] ?? [])].sort().join(",")}`).join("|")
      : "";
  const ex =
    excludedIngredients && excludedIngredients.length > 0
      ? [...excludedIngredients].sort().join(",")
      : "";
  if (!flat && !ex) return itemId;
  const parts = [itemId];
  if (flat) parts.push(flat);
  if (ex) parts.push(`ex:${ex}`);
  return parts.join("||");
}

export function defaultDotykackaPicks(item: MenuItemData): Record<string, string[]> {
  const groups = item.dotykackaCustomizationGroups;
  if (!groups?.length) return {};
  const out: Record<string, string[]> = {};
  for (const g of groups) {
    if (g.minPick >= 1) {
      if (g.defaultOptionIds.length > 0) {
        out[g.id] = [...g.defaultOptionIds];
      } else if (g.options[0]) {
        out[g.id] = [g.options[0].id];
      } else {
        out[g.id] = [];
      }
      continue;
    }
    // Volitelná skupina (min 0): nic nepředvybírat.
    out[g.id] = [];
  }
  return out;
}

export function dotykackaExtraUnitPriceCzk(
  item: MenuItemData,
  picks: Record<string, string[]> | undefined,
): number {
  if (!item.dotykackaCustomizationGroups?.length || !picks) return 0;
  let sum = 0;
  for (const g of item.dotykackaCustomizationGroups) {
    for (const optId of picks[g.id] ?? []) {
      const o = g.options.find((x) => x.id === optId);
      if (o) sum += o.priceCzk;
    }
  }
  return sum;
}

export function validateDotykackaPicks(
  item: MenuItemData,
  picks: Record<string, string[]>,
): string | null {
  const groups = item.dotykackaCustomizationGroups;
  if (!groups?.length) return null;
  for (const g of groups) {
    const sel = picks[g.id] ?? [];
    if (sel.length < g.minPick) {
      return `Vyberte alespoň ${g.minPick} v: ${g.sectionLabel}`;
    }
    if (sel.length > g.maxPick) {
      return `Maximálně ${g.maxPick} v: ${g.sectionLabel}`;
    }
  }
  return null;
}

export type DotykackaPosCustomization = {
  productCustomizationId: number;
  productId: number;
  qty: number;
};

export function buildDotykackaPosCustomizations(
  item: MenuItemData,
  picks: Record<string, string[]> | undefined,
): DotykackaPosCustomization[] {
  const groups = item.dotykackaCustomizationGroups;
  if (!groups?.length || !picks) return [];
  const out: DotykackaPosCustomization[] = [];
  for (const g of groups) {
    for (const optId of picks[g.id] ?? []) {
      const o = g.options.find((x) => x.id === optId);
      if (!o) continue;
      out.push({
        productCustomizationId: g.customizationId,
        productId: o.productId,
        qty: 1,
      });
    }
  }
  return out;
}
