import type { AdminSession } from "./adminGuard";
import { activeRestaurantCookieName, userHasRestaurantAccess } from "./auth";

function cookieValue(cookieHeader: string | null | undefined, name: string): string {
  const raw = typeof cookieHeader === "string" ? cookieHeader : "";
  if (!raw) return "";
  const parts = raw.split(";").map((p) => p.trim());
  const hit = parts.find((p) => p.startsWith(`${name}=`));
  if (!hit) return "";
  return hit.slice(`${name}=`.length);
}

/** Úpravy menu jen pro aktivní restauraci v cookie a s oprávněním (vedoucí/personál/superadmin). */
export async function canEditMenuForRestaurant(
  session: AdminSession,
  cookieHeader: string | null | undefined,
  restaurantId: string,
): Promise<boolean> {
  const rid = cookieValue(cookieHeader, activeRestaurantCookieName());
  if (rid !== restaurantId) return false;
  if (session.globalRole === "SUPER_ADMIN") return true;
  return (await userHasRestaurantAccess(session.userId, restaurantId)).ok;
}
