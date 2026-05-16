import { NextResponse } from "next/server";

import { resolvePublicMenuRestaurantIdFromRequestUrl } from "../../../../lib/server/publicMenuRestaurantResolve";
import { listEnabledLocalesForRestaurant } from "../../../../lib/server/restaurantLocales";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = await resolvePublicMenuRestaurantIdFromRequestUrl(req);
  const locales = await listEnabledLocalesForRestaurant(restaurantId ?? "");
  return NextResponse.json({ ok: true, locales }, { headers: { "Cache-Control": "private, no-store, no-cache, must-revalidate" } });
}

