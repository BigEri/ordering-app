import { NextResponse } from "next/server";

import { resolvePublicMenuRestaurantIdFromRequestUrl } from "../../../../lib/server/publicMenuRestaurantResolve";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = await resolvePublicMenuRestaurantIdFromRequestUrl(req);
  return NextResponse.json({ ok: true, restaurantId });
}
