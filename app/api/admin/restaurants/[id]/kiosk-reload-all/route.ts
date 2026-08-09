import { NextResponse } from "next/server";

import { invalidateDotykackaMenuCache } from "../../../../../../lib/dotykacka/menuCache";
import { requireAdminSession } from "../../../../../../lib/server/adminGuard";
import { userHasRestaurantAccess } from "../../../../../../lib/server/auth";
import { bumpAllKioskDeviceReloadNoncesForRestaurant } from "../../../../../../lib/server/kioskDeviceBindings";
import { prisma } from "../../../../../../lib/server/prisma";

export const dynamic = "force-dynamic";

/**
 * Admin (vedoucí / SUPER): vynutí obnovení stránky na všech tabletech provozovny.
 * Zruší cache menu z Dotykačky; tablety obnoví stránku po dalším pollu config (~15 s).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession(req.headers.get("cookie"));
    const { id } = await ctx.params;
    const restaurantId = typeof id === "string" ? id.trim() : "";
    if (!restaurantId) {
      return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    }

    if (session.globalRole !== "SUPER_ADMIN") {
      const access = await userHasRestaurantAccess(session.userId, restaurantId);
      if (!access.ok) {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      }
    }

    const exists = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    invalidateDotykackaMenuCache(restaurantId);
    const devicesSignaled = await bumpAllKioskDeviceReloadNoncesForRestaurant(restaurantId);

    return NextResponse.json({
      ok: true,
      restaurantId,
      devicesSignaled,
      menuCacheInvalidated: true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}
