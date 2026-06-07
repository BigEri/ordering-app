import { cookies } from "next/headers";

import { activeRestaurantCookieName, getSessionFromCookieHeader } from "./auth";
import { resolveAdminMenuRestaurantIdForSession } from "./publicMenuRestaurantResolve";

function cookieHeaderFromStore(jar: Awaited<ReturnType<typeof cookies>>): string {
  return jar
    .getAll()
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join("; ");
}

/**
 * Aktivní provozovna pro admin menu — personál nikdy nedostane cizí restauraci kvůli špatnému `oa_rid`.
 */
export async function getAdminMenuRestaurantId(): Promise<string | null> {
  const jar = await cookies();
  const active = jar.get(activeRestaurantCookieName())?.value?.trim() ?? "";
  const session = getSessionFromCookieHeader(cookieHeaderFromStore(jar));
  return resolveAdminMenuRestaurantIdForSession(session, active || null);
}
