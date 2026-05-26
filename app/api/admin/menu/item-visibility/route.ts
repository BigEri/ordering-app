import { NextResponse } from "next/server";

import { requireAdminSession } from "../../../../../lib/server/adminGuard";
import { nowIso } from "../../../../../lib/server/db";
import { canEditMenuForRestaurant } from "../../../../../lib/server/menuEditorAuth";
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
    const hidden = o.hidden === true;

    if (!restaurantId || !menuItemId) {
      return NextResponse.json({ ok: false, error: "Missing restaurantId/menuItemId" }, { status: 400 });
    }
    if (!(await canEditMenuForRestaurant(session, cookieHeader, restaurantId))) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const exists = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } });
    if (!exists?.id) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const ts = nowIso();
    if (hidden) {
      await prisma.menuHiddenItem.upsert({
        where: { restaurantId_menuItemId: { restaurantId, menuItemId } },
        update: { hidden: 1, updatedAtIso: ts, updatedByUserId: session.userId },
        create: { restaurantId, menuItemId, hidden: 1, updatedAtIso: ts, updatedByUserId: session.userId },
      });
    } else {
      await prisma.menuHiddenItem.deleteMany({ where: { restaurantId, menuItemId } });
    }

    return NextResponse.json({ ok: true, restaurantId, menuItemId, hidden });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}

