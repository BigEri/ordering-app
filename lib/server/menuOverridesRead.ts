import { prisma } from "./prisma";

export type MenuOverridesPayload = {
  images: Record<string, string>;
  orderByCategory: Record<string, string[]>;
  hiddenItemIds: string[];
  hiddenCategoryKeys: string[];
};

export async function readMenuOverridesForRestaurant(restaurantId: string): Promise<MenuOverridesPayload> {
  const imgRows = await prisma.menuImage.findMany({
    where: { restaurantId: restaurantId.trim() },
    select: { menuItemId: true, imageUrl: true },
  });
  const images: Record<string, string> = {};
  for (const r of imgRows) {
    if (r.menuItemId && r.imageUrl) images[r.menuItemId] = r.imageUrl;
  }

  const posRows = await prisma.menuItemPosition.findMany({
    where: { restaurantId: restaurantId.trim() },
    orderBy: [{ categoryKey: "asc" }, { position: "asc" }],
    select: { categoryKey: true, menuItemId: true, position: true },
  });

  const orderByCategory: Record<string, string[]> = {};
  for (const r of posRows) {
    if (!orderByCategory[r.categoryKey]) orderByCategory[r.categoryKey] = [];
    orderByCategory[r.categoryKey].push(r.menuItemId);
  }

  const hiddenRows = await prisma.menuHiddenItem.findMany({
    where: { restaurantId: restaurantId.trim(), hidden: 1 },
    select: { menuItemId: true },
  });
  const hiddenItemIds = hiddenRows.map((r) => r.menuItemId).filter((x) => typeof x === "string" && x.trim() !== "");

  const hiddenCatRows = await prisma.menuHiddenCategory.findMany({
    where: { restaurantId: restaurantId.trim(), hidden: 1 },
    select: { categoryKey: true },
  });
  const hiddenCategoryKeys = hiddenCatRows
    .map((r) => r.categoryKey)
    .filter((x) => typeof x === "string" && x.trim() !== "");

  return { images, orderByCategory, hiddenItemIds, hiddenCategoryKeys };
}
