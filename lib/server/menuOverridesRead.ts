import { parseCategoryHoursMap } from "../menu/categoryHours";
import { type MenuOverridesPayload } from "../menu/parseMenuOverrides";
import { prisma } from "./prisma";

export type { MenuOverridesPayload } from "../menu/parseMenuOverrides";
export { EMPTY_MENU_OVERRIDES, menuOverridesFromApiJson } from "../menu/parseMenuOverrides";

export async function readMenuOverridesForRestaurant(restaurantId: string): Promise<MenuOverridesPayload> {
  const rid = restaurantId.trim();
  const [imgRows, posRows, hiddenRows, hiddenCatRows, hoursRows] = await Promise.all([
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
    prisma.menuCategorySchedule
      .findMany({
        where: { restaurantId: rid },
        select: { categoryKey: true, visibleFrom: true, visibleUntil: true },
      })
      .catch(() => [] as { categoryKey: string; visibleFrom: string; visibleUntil: string }[]),
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

  const categoryHours = parseCategoryHoursMap(
    Object.fromEntries(hoursRows.map((r) => [r.categoryKey, { visibleFrom: r.visibleFrom, visibleUntil: r.visibleUntil }])),
  );

  return { images, orderByCategory, hiddenItemIds, hiddenCategoryKeys, categoryHours };
}
