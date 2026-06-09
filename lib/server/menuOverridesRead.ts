import { prisma } from "./prisma";

export type MenuOverridesPayload = {
  images: Record<string, string>;
  orderByCategory: Record<string, string[]>;
  hiddenItemIds: string[];
  hiddenCategoryKeys: string[];
};

export async function readMenuOverridesForRestaurant(restaurantId: string): Promise<MenuOverridesPayload> {
  const rid = restaurantId.trim();
  const [imgRows, posRows, hiddenRows, hiddenCatRows] = await Promise.all([
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

  return { images, orderByCategory, hiddenItemIds, hiddenCategoryKeys };
}
