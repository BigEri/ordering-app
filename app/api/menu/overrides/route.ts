import { NextResponse } from "next/server";

import { readMenuOverridesForRestaurantCached } from "../../../../lib/server/menuOverridesCached";
import { resolvePublicMenuApiRestaurantIdAsync } from "../../../../lib/server/publicMenuRestaurantResolve";

export const dynamic = "force-dynamic";

/** Veřejné načtení úprav menu (fotky + pořadí) pro zobrazení hostům. */
export async function GET(req: Request) {
  const ctx = await resolvePublicMenuApiRestaurantIdAsync(req);
  if (!ctx.ok) {
    return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });
  }
  const { restaurantId } = ctx;

  const payload = await readMenuOverridesForRestaurantCached(restaurantId);
  return NextResponse.json({ ok: true, restaurantId, ...payload });
}
