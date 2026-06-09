import { NextResponse } from "next/server";

import { requireAdminSession } from "../../../../../lib/server/adminGuard";
import { canEditMenuForRestaurant } from "../../../../../lib/server/menuEditorAuth";
import { invalidateMenuOverridesCache } from "../../../../../lib/server/menuOverridesCached";
import { prisma } from "../../../../../lib/server/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  try {
    const session = await requireAdminSession(req.headers.get("cookie"));
    const cookieHeader = req.headers.get("cookie");
    let body: unknown;
    try {
      body = (await req.json()) as unknown;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }
    const o = body as Record<string, unknown>;
    const restaurantId = typeof o.restaurantId === "string" ? o.restaurantId.trim() : "";
    const categoryKey = typeof o.categoryKey === "string" ? o.categoryKey.trim() : "";
    const orderedMenuItemIds = Array.isArray(o.orderedMenuItemIds) ? o.orderedMenuItemIds : null;

    if (!restaurantId || !categoryKey || !orderedMenuItemIds) {
      return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
    }
    const ids = orderedMenuItemIds.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim());
    if (ids.length > 500) {
      return NextResponse.json({ ok: false, error: "Too many items" }, { status: 400 });
    }

    if (!(await canEditMenuForRestaurant(session, cookieHeader, restaurantId))) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const exists = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } });
    if (!exists?.id) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.menuItemPosition.deleteMany({ where: { restaurantId, categoryKey } });
      if (ids.length === 0) return;
      await tx.menuItemPosition.createMany({
        data: ids.map((menuItemId, idx) => ({
          restaurantId,
          categoryKey,
          menuItemId,
          position: idx,
        })),
      });
    });

    invalidateMenuOverridesCache(restaurantId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}
