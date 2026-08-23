import { NextResponse } from "next/server";

import { normalizeHhmm } from "../../../../../lib/menu/categoryHours";
import { requireAdminSession } from "../../../../../lib/server/adminGuard";
import { nowIso } from "../../../../../lib/server/db";
import { canEditMenuForRestaurant } from "../../../../../lib/server/menuEditorAuth";
import { invalidateMenuOverridesCache } from "../../../../../lib/server/menuOverridesCached";
import { prisma } from "../../../../../lib/server/prisma";

export const dynamic = "force-dynamic";

/**
 * Admin: denní okno viditelnosti sekce (Evropa/Praha).
 * Obě pole prázdná = vždy vidět. Jinak obě HH:mm, half-open [od, do).
 */
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
    const fromRaw = typeof o.visibleFrom === "string" ? o.visibleFrom : "";
    const untilRaw = typeof o.visibleUntil === "string" ? o.visibleUntil : "";

    if (!restaurantId || !categoryKey) {
      return NextResponse.json({ ok: false, error: "Missing restaurantId/categoryKey" }, { status: 400 });
    }
    if (!(await canEditMenuForRestaurant(session, cookieHeader, restaurantId))) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const exists = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } });
    if (!exists?.id) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const fromTrim = fromRaw.trim();
    const untilTrim = untilRaw.trim();
    const clear = fromTrim === "" && untilTrim === "";
    const visibleFrom = clear ? null : normalizeHhmm(fromTrim);
    const visibleUntil = clear ? null : normalizeHhmm(untilTrim);

    if (!clear && (!visibleFrom || !visibleUntil)) {
      return NextResponse.json({ ok: false, error: "Čas Od i Do musí být ve formátu HH:mm." }, { status: 400 });
    }
    if (visibleFrom && visibleUntil && visibleFrom === visibleUntil) {
      return NextResponse.json({ ok: false, error: "Od a Do nesmí být stejný čas." }, { status: 400 });
    }

    const ts = nowIso();
    if (clear) {
      await prisma.menuCategorySchedule.deleteMany({ where: { restaurantId, categoryKey } });
    } else {
      await prisma.menuCategorySchedule.upsert({
        where: { restaurantId_categoryKey: { restaurantId, categoryKey } },
        update: {
          visibleFrom: visibleFrom!,
          visibleUntil: visibleUntil!,
          updatedAtIso: ts,
          updatedByUserId: session.userId,
        },
        create: {
          restaurantId,
          categoryKey,
          visibleFrom: visibleFrom!,
          visibleUntil: visibleUntil!,
          updatedAtIso: ts,
          updatedByUserId: session.userId,
        },
      });
    }

    invalidateMenuOverridesCache(restaurantId);
    return NextResponse.json({
      ok: true,
      restaurantId,
      categoryKey,
      visibleFrom: clear ? null : visibleFrom,
      visibleUntil: clear ? null : visibleUntil,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}
