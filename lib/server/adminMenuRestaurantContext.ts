import { cookies } from "next/headers";

import { activeRestaurantCookieName } from "./auth";

/** Aktivní provozovna z cookie `oa_rid` — bez ní administrace menu nepoužívá „náhodnou“ výchozí DB. */
export async function getAdminMenuRestaurantId(): Promise<string | null> {
  const jar = await cookies();
  const fromCookie = jar.get(activeRestaurantCookieName())?.value?.trim() ?? "";
  return fromCookie || null;
}
