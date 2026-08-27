import { NextResponse } from "next/server";

import { CATEGORY_SCHEDULE_ALWAYS, normalizeHhmm } from "../../../../../lib/menu/categoryHours";
import { requireAdminSession } from "../../../../../lib/server/adminGuard";
import { nowIso } from "../../../../../lib/server/db";
import { canEditMenuForRestaurant } from "../../../../../lib/server/menuEditorAuth";
import { invalidateMenuOverridesCache } from "../../../../../lib/server/menuOverridesCached";
import { prisma } from "../../../../../lib/server/prisma";
import { upsertMenuCategoryScheduleRow } from "../../../../../lib/server/upsertMenuCategorySchedule";

export const dynamic = "force-dynamic";

/**
 * Admin: viditelnost sekce.
 * always=true → Pořád (i během časového menu).
 * Obě pole prázdná (a always ne) → základní nabídka.
 * Jinak obě HH:mm, half-open [od, do).
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
    const always = o.always === true;

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
    const clearToBase = !always && fromTrim === "" && untilTrim === "";
    const visibleFrom = always || clearToBase ? null : normalizeHhmm(fromTrim);
    const visibleUntil = always || clearToBase ? null : normalizeHhmm(untilTrim);

    if (!always && !clearToBase && (!visibleFrom || !visibleUntil)) {
      return NextResponse.json({ ok: false, error: "Čas Od i Do musí být ve formátu HH:mm." }, { status: 400 });
    }
    if (visibleFrom && visibleUntil && visibleFrom === visibleUntil) {
      return NextResponse.json({ ok: false, error: "Od a Do nesmí být stejný čas." }, { status: 400 });
    }

    const ts = nowIso();
    if (clearToBase) {
      await prisma.menuCategorySchedule.deleteMany({ where: { restaurantId, categoryKey } });
    } else {
      const visibleFromStored = always ? CATEGORY_SCHEDULE_ALWAYS : visibleFrom;
      const visibleUntilStored = always ? CATEGORY_SCHEDULE_ALWAYS : visibleUntil;
      if (!visibleFromStored || !visibleUntilStored) {
        return NextResponse.json({ ok: false, error: "Čas Od i Do musí být ve formátu HH:mm." }, { status: 400 });
      }
      await upsertMenuCategoryScheduleRow({
        restaurantId,
        categoryKey,
        visibleFrom: visibleFromStored,
        visibleUntil: visibleUntilStored,
        always,
        updatedAtIso: ts,
        updatedByUserId: session.userId,
      });
    }

    invalidateMenuOverridesCache(restaurantId);
    return NextResponse.json({
      ok: true,
      restaurantId,
      categoryKey,
      always,
      visibleFrom: always || clearToBase ? null : visibleFrom,
      visibleUntil: always || clearToBase ? null : visibleUntil,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ ok: false, error: "Uložení času kategorie se nezdařilo." }, { status: 500 });
  }
}
