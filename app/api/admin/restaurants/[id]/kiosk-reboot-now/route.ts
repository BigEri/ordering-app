import { NextResponse } from "next/server";

import { requireAdminSession } from "../../../../../../lib/server/adminGuard";
import { bumpAllKioskDeviceRebootNoncesForRestaurant } from "../../../../../../lib/server/kioskDeviceBindings";
import { prisma } from "../../../../../../lib/server/prisma";

export const dynamic = "force-dynamic";

/** SUPER_ADMIN: bump rebootNonce u všech tabletů provozovny. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession(req.headers.get("cookie"));
    if (session.globalRole !== "SUPER_ADMIN") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    const { id } = await ctx.params;
    const restaurantId = typeof id === "string" ? id.trim() : "";
    if (!restaurantId) {
      return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    }
    const exists = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    const count = await bumpAllKioskDeviceRebootNoncesForRestaurant(restaurantId);
    return NextResponse.json({ ok: true, restaurantId, devicesSignaled: count });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}
