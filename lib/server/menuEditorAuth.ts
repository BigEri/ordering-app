import type { AdminSession } from "./adminGuard";
import { userHasRestaurantAccess } from "./auth";

/**
 * Úpravy menu pro danou provozovnu — `restaurantId` z URL/těla má přednost před cookie.
 * Superadmin: jakákoli restaurace. Ostatní: membership (cookie nemusí sedět 1:1).
 */
export async function canEditMenuForRestaurant(
  session: AdminSession,
  _cookieHeader: string | null | undefined,
  restaurantId: string,
): Promise<boolean> {
  const rid = restaurantId.trim();
  if (!rid) return false;
  if (session.globalRole === "SUPER_ADMIN") return true;
  return (await userHasRestaurantAccess(session.userId, rid)).ok;
}
