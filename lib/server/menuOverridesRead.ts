import { parseCategoryHoursMap } from "../menu/categoryHours";
import { isAlwaysScheduleTimes } from "../menu/categoryHours";
import { parseMenuItemBadgesJson, type MenuItemBadgeKey } from "../menu/menuItemBadges";
import { type MenuOverridesPayload } from "../menu/parseMenuOverrides";
import { prisma } from "./prisma";

export type { MenuOverridesPayload } from "../menu/parseMenuOverrides";
export { EMPTY_MENU_OVERRIDES, menuOverridesFromApiJson } from "../menu/parseMenuOverrides";

export async function readMenuOverridesForRestaurant(restaurantId: string): Promise<MenuOverridesPayload> {
  const rid = restaurantId.trim();
  const [imgRows, posRows, hiddenRows, hiddenCatRows, hoursRows, badgeRows] = await Promise.all([
    prisma.menuImage.findMany({
      where: { restaurantId: rid },
      select: { menuItemId: true, imageUrl: true },
    }),
    prisma.menuItemPosition.findMany({
      where: { restaurantId: rid },
      orderBy: [{ categoryKey: "asc" }, { position: "asc" }],
      select: { categoryKey: true, menuItemId: true, position: true },
    }),
    prisma.menuHiddenItem.findMany({
      where: { restaurantId: rid, hidden: 1 },
      select: { menuItemId: true },
    }),
    prisma.menuHiddenCategory.findMany({
      where: { restaurantId: rid, hidden: 1 },
      select: { categoryKey: true },
    }),
    (async () => {
      try {
        return await prisma.menuCategorySchedule.findMany({
          where: { restaurantId: rid },
          select: { categoryKey: true, visibleFrom: true, visibleUntil: true, alwaysVisible: true },
        });
      } catch {
        try {
          const fallback = await prisma.menuCategorySchedule.findMany({
            where: { restaurantId: rid },
            select: { categoryKey: true, visibleFrom: true, visibleUntil: true },
          });
          return fallback.map((r) => ({
            ...r,
            alwaysVisible: 0,
          }));
        } catch {
          return [] as {
            categoryKey: string;
            visibleFrom: string | null;
            visibleUntil: string | null;
            alwaysVisible: number;
          }[];
        }
      }
    })(),
    (async () => {
      try {
        return await prisma.menuItemBadge.findMany({
          where: { restaurantId: rid },
          select: { menuItemId: true, badgesJson: true },
        });
      } catch {
        return [] as { menuItemId: string; badgesJson: string }[];
      }
    })(),
  ]);

  const images: Record<string, string> = {};
  for (const r of imgRows) {
    if (r.menuItemId && r.imageUrl) images[r.menuItemId] = r.imageUrl;
  }

  const orderByCategory: Record<string, string[]> = {};
  for (const r of posRows) {
    if (!orderByCategory[r.categoryKey]) orderByCategory[r.categoryKey] = [];
    orderByCategory[r.categoryKey].push(r.menuItemId);
  }

  const hiddenItemIds = hiddenRows.map((r) => r.menuItemId).filter((x) => typeof x === "string" && x.trim() !== "");

  const hiddenCategoryKeys = hiddenCatRows
    .map((r) => r.categoryKey)
    .filter((x) => typeof x === "string" && x.trim() !== "");

  const alwaysVisibleCategoryKeys = hoursRows
    .filter((r) => r.alwaysVisible === 1 || isAlwaysScheduleTimes(r.visibleFrom, r.visibleUntil))
    .map((r) => r.categoryKey)
    .filter((x) => typeof x === "string" && x.trim() !== "");

  const alwaysSet = new Set(alwaysVisibleCategoryKeys);
  const categoryHours = parseCategoryHoursMap(
    Object.fromEntries(
      hoursRows
        .filter((r) => !alwaysSet.has(r.categoryKey))
        .map((r) => [r.categoryKey, { visibleFrom: r.visibleFrom, visibleUntil: r.visibleUntil }]),
    ),
  );

  const itemBadges: Record<string, MenuItemBadgeKey[]> = {};
  for (const r of badgeRows) {
    const id = typeof r.menuItemId === "string" ? r.menuItemId.trim() : "";
    if (!id) continue;
    const list = parseMenuItemBadgesJson(r.badgesJson);
    if (list.length) itemBadges[id] = list;
  }

  return {
    images,
    orderByCategory,
    hiddenItemIds,
    hiddenCategoryKeys,
    categoryHours,
    alwaysVisibleCategoryKeys,
    itemBadges,
  };
}
