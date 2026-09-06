import { NextResponse } from "next/server";

import { isMenuItemBadgeKey, parseMenuItemBadgesJson, stringifyMenuItemBadges, toggleMenuItemBadge } from "../../../../../lib/menu/menuItemBadges";
import { requireAdminSession } from "../../../../../lib/server/adminGuard";
import { nowIso } from "../../../../../lib/server/db";
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
    const menuItemId = typeof o.menuItemId === "string" ? o.menuItemId.trim() : "";
    const badge = o.badge;
    const enabled = o.enabled === true;

    if (!restaurantId || !menuItemId) {
      return NextResponse.json({ ok: false, error: "Missing restaurantId/menuItemId" }, { status: 400 });
    }
    if (!isMenuItemBadgeKey(badge)) {
      return NextResponse.json({ ok: false, error: "Invalid badge" }, { status: 400 });
    }
    if (!(await canEditMenuForRestaurant(session, cookieHeader, restaurantId))) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const exists = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } });
    if (!exists?.id) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const current = await prisma.menuItemBadge.findUnique({
      where: { restaurantId_menuItemId: { restaurantId, menuItemId } },
      select: { badgesJson: true },
    });
    const next = toggleMenuItemBadge(current ? parseMenuItemBadgesJson(current.badgesJson) : [], badge, enabled);
    const ts = nowIso();

    if (next.length === 0) {
      await prisma.menuItemBadge.deleteMany({ where: { restaurantId, menuItemId } });
    } else {
      await prisma.menuItemBadge.upsert({
        where: { restaurantId_menuItemId: { restaurantId, menuItemId } },
        update: { badgesJson: stringifyMenuItemBadges(next), updatedAtIso: ts, updatedByUserId: session.userId },
        create: {
          restaurantId,
          menuItemId,
          badgesJson: stringifyMenuItemBadges(next),
          updatedAtIso: ts,
          updatedByUserId: session.userId,
        },
      });
    }

    invalidateMenuOverridesCache(restaurantId);
    return NextResponse.json({ ok: true, restaurantId, menuItemId, badge, enabled, badges: next });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}
