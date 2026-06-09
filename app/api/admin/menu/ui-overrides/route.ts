import { NextResponse } from "next/server";

import { requireAdminSession } from "../../../../../lib/server/adminGuard";
import { canEditMenuForRestaurant } from "../../../../../lib/server/menuEditorAuth";
import { readAllDotykackaLabelsForRestaurant } from "../../../../../lib/server/menuDotykackaLabels";
import { readAllMenuIngredientOverridesForRestaurant } from "../../../../../lib/server/menuIngredientOverrides";
import { readAllMenuTextOverridesForRestaurant } from "../../../../../lib/server/menuTextOverrides";
import { prisma } from "../../../../../lib/server/prisma";

export const dynamic = "force-dynamic";

/** Admin: texty + ingredience + Dotyka labels pro všechny jazyky v jednom requestu. */
export async function GET(req: Request) {
  try {
    const session = await requireAdminSession(req.headers.get("cookie"));
    const cookieHeader = req.headers.get("cookie");
    const url = new URL(req.url);
    const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
    if (!restaurantId) {
      return NextResponse.json({ ok: false, error: "Missing restaurantId" }, { status: 400 });
    }
    if (!(await canEditMenuForRestaurant(session, cookieHeader, restaurantId))) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const exists = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } });
    if (!exists?.id) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const [text, ingredients, dotykacka] = await Promise.all([
      readAllMenuTextOverridesForRestaurant(restaurantId),
      readAllMenuIngredientOverridesForRestaurant(restaurantId),
      readAllDotykackaLabelsForRestaurant(restaurantId),
    ]);

    return NextResponse.json({ ok: true, restaurantId, text, ingredients, dotykacka });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
}
