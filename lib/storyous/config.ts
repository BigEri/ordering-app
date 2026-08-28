import { getRestaurantStoryousRow } from "../server/restaurantStoryous";
import { getStoryousAppCredentials, type StoryousAppCredentials } from "./env";

export type StoryousRestaurantConfig = StoryousAppCredentials & {
  merchantId: string;
  placeId: string;
};

export async function getStoryousConfig(restaurantId: string): Promise<StoryousRestaurantConfig | null> {
  const creds = getStoryousAppCredentials();
  if (!creds) return null;
  const row = await getRestaurantStoryousRow(restaurantId);
  if (!row || row.disabled === 1) return null;
  if (!row.merchantId.trim() || !row.placeId.trim()) return null;
  return {
    ...creds,
    merchantId: row.merchantId.trim(),
    placeId: row.placeId.trim(),
  };
}
