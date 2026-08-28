import { getDotykackaMenuFetchConfig } from "../dotykacka/config";
import { getRestaurantStoryousRow } from "../server/restaurantStoryous";

export type RestaurantMenuSource = "storyous" | "dotykacka";

function storyousRowIsConnected(row: { disabled: number; merchantId: string; placeId: string } | null): boolean {
  return Boolean(row && row.disabled !== 1 && row.merchantId.trim() && row.placeId.trim());
}

/** Storyous má přednost — nikdy nepadat na Dotykačku, když je restaurace napojená na Storyous. */
export async function getRestaurantMenuSource(
  restaurantId: string,
): Promise<RestaurantMenuSource | null> {
  const rid = restaurantId.trim();
  if (!rid) return null;
  if (storyousRowIsConnected(await getRestaurantStoryousRow(rid))) return "storyous";
  if (await getDotykackaMenuFetchConfig(rid)) return "dotykacka";
  return null;
}
