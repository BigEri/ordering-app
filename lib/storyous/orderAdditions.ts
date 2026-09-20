import type { MenuItemData } from "../../components/MenuItem";

export type StoryousDeliveryAddition = {
  additionId: string;
  countPerMainItem: number;
  unitPriceWithVat: number;
};

export function buildStoryousPosAdditions(
  item: MenuItemData,
  picks: Record<string, string[]> | undefined,
): StoryousDeliveryAddition[] {
  const groups = item.dotykackaCustomizationGroups;
  if (!groups?.length || !picks) return [];
  const out: StoryousDeliveryAddition[] = [];
  for (const g of groups) {
    for (const optId of picks[g.id] ?? []) {
      const o = g.options.find((x) => x.id === optId);
      if (!o) continue;
      out.push({
        additionId: o.id,
        countPerMainItem: 1,
        unitPriceWithVat: o.priceCzk,
      });
    }
  }
  return out;
}
