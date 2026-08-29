import { headers } from "next/headers";

import { resolvePublicMenuRestaurantIdSlimFromRequestUrl } from "./publicMenuRestaurantResolve";
import { getPublicRestaurantDisplayNameForRestaurantId } from "./publicRestaurantName";

/**
 * SSR Request se stejnými cookies jako příchozí Next.js request.
 * `pathAndQuery` např. `"/"` nebo `"/menu?rid=…"` — layout nemá search params, stačí `/`.
 */
export async function requestFromIncomingHeaders(pathAndQuery: string): Promise<Request> {
  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const path = pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`;
  const url = new URL(path, `${proto}://${host}`);
  return new Request(url.toString(), { headers: { cookie: cookieHeader } });
}

/** Název provozovny podle kiosk cookie / vazby tabletu — ne jen `PUBLIC_RESTAURANT_ID`. */
export async function getPublicRestaurantDisplayNameFromIncomingRequest(pathAndQuery = "/"): Promise<string> {
  const req = await requestFromIncomingHeaders(pathAndQuery);
  const restaurantId = await resolvePublicMenuRestaurantIdSlimFromRequestUrl(req);
  return getPublicRestaurantDisplayNameForRestaurantId(restaurantId);
}
