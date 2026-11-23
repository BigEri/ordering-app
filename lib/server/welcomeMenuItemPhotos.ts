import { fetchRestaurantMenuCached } from "../menu/fetchRestaurantMenu";
import { parseWelcomeMenuItemRef } from "../menu/welcomeMenuItemRef";
import { prisma } from "./prisma";

export type WelcomeMenuItemPhoto = { imageUrl: string; name: string };

/**
 * Aktuální fotka jídel podle odkazů `menu-item:` — nahraná v TableFlow má přednost před fotkou z pokladny,
 * stejně jako v menu na tabletu.
 */
export async function resolveWelcomeMenuItemPhotos(
  restaurantId: string,
  entries: readonly string[],
): Promise<Map<string, WelcomeMenuItemPhoto>> {
  const out = new Map<string, WelcomeMenuItemPhoto>();
  const ids = [...new Set(entries.map(parseWelcomeMenuItemRef).filter((x): x is string => Boolean(x)))];
  if (ids.length === 0) return out;

  const [uploads, menu] = await Promise.all([
    prisma.menuImage.findMany({
      where: { restaurantId, menuItemId: { in: ids }, imageUrl: { not: "" } },
      select: { menuItemId: true, imageUrl: true },
    }),
    fetchRestaurantMenuCached(restaurantId).catch(() => null),
  ]);

  const posItems = new Map((menu?.ok ? menu.sections.flatMap((s) => s.items) : []).map((it) => [it.id, it]));
  const uploadById = new Map(uploads.map((u) => [u.menuItemId, u.imageUrl.trim()]));

  for (const id of ids) {
    const item = posItems.get(id);
    const imageUrl = uploadById.get(id) || item?.imageUrl?.trim() || "";
    if (imageUrl) out.set(id, { imageUrl, name: item?.name ?? "" });
  }
  return out;
}
