import { cookies } from "next/headers";

import { getSessionFromCookieHeader, userHasRestaurantAccess } from "./auth";
import { prisma } from "./prisma";

function cookieHeaderFromStore(jar: Awaited<ReturnType<typeof cookies>>): string {
  return jar
    .getAll()
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join("; ");
}

export type AdminRestaurantPageAccess =
  | { ok: true; restaurantId: string; name: string }
  | { ok: false; error: "unauthorized" | "forbidden" | "not_found" };

/** SSR guard for restaurant-scoped admin pages (menu, translations, …). */
export async function resolveAdminRestaurantPageAccess(restaurantIdRaw: string): Promise<AdminRestaurantPageAccess> {
  const restaurantId = restaurantIdRaw.trim();
  if (!restaurantId) return { ok: false, error: "not_found" };

  const jar = await cookies();
  const session = getSessionFromCookieHeader(cookieHeaderFromStore(jar));
  if (!session) return { ok: false, error: "unauthorized" };

  if (session.globalRole !== "SUPER_ADMIN") {
    const access = await userHasRestaurantAccess(session.userId, restaurantId);
    if (!access.ok) return { ok: false, error: "forbidden" };
  }

  const row = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true },
  });
  if (!row?.id) return { ok: false, error: "not_found" };

  return { ok: true, restaurantId: row.id, name: row.name.trim() || row.id };
}
