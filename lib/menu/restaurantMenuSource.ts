import { getDotykackaMenuFetchConfig } from "../dotykacka/config";
import { parseRestaurantPos, type RestaurantPos } from "../pos/restaurantPos";
import { prisma } from "../server/prisma";
import { getRestaurantStoryousRow } from "../server/restaurantStoryous";

export type RestaurantMenuSource = RestaurantPos;

function storyousRowIsConnected(row: { disabled: number; merchantId: string; placeId: string } | null): boolean {
  return Boolean(row && row.disabled !== 1 && row.merchantId.trim() && row.placeId.trim());
}

export async function getRestaurantPos(restaurantId: string): Promise<RestaurantPos | null> {
  const rid = restaurantId.trim();
  if (!rid) return null;
  const row = await prisma.restaurant.findUnique({
    where: { id: rid },
    select: { pos: true },
  });
  return parseRestaurantPos(row?.pos);
}

/** Pokladna provozovny — uložený výběr, jinak podle napojení. */
export async function getRestaurantMenuSource(
  restaurantId: string,
): Promise<RestaurantMenuSource | null> {
  const rid = restaurantId.trim();
  if (!rid) return null;
  const declared = await getRestaurantPos(rid);
  if (declared) return declared;
  if (storyousRowIsConnected(await getRestaurantStoryousRow(rid))) return "storyous";
  if (await getDotykackaMenuFetchConfig(rid)) return "dotykacka";
  return null;
}
