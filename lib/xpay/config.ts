import { getDefaultPublicMenuRestaurantIdFromEnv } from "../server/publicRestaurantName";
import { getRestaurantXpayApiKey, getRestaurantXpayRow } from "../server/restaurantXpay";
import type { XpayCredentials } from "./client";
import { xpayEnvApiKey, xpayEnvEnvironment } from "./env";

export function shouldUseEnvXpayFallback(restaurantId: string): boolean {
  const rid = restaurantId.trim();
  if (!rid) return false;
  const envPublic = process.env.PUBLIC_RESTAURANT_ID?.trim();
  if (envPublic && envPublic === rid) return true;
  const def = getDefaultPublicMenuRestaurantIdFromEnv();
  return Boolean(def && def === rid);
}

export async function getXpayCredentials(restaurantId: string): Promise<XpayCredentials | null> {
  const rid = restaurantId.trim();
  if (!rid) return null;

  const row = await getRestaurantXpayRow(rid);
  if (row?.disabled) return null;
  if (row?.hasApiKey) {
    const apiKey = await getRestaurantXpayApiKey(rid);
    if (apiKey) return { apiKey, environment: row.environment };
  }

  const envKey = xpayEnvApiKey();
  if (envKey && shouldUseEnvXpayFallback(rid)) {
    return { apiKey: envKey, environment: row?.environment ?? xpayEnvEnvironment() };
  }
  return null;
}
