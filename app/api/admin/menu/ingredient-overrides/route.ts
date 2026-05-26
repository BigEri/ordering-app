import { NextResponse } from "next/server";

import { requireAdminSession } from "../../../../../lib/server/adminGuard";
import { nowIso } from "../../../../../lib/server/db";
import { canEditMenuForRestaurant } from "../../../../../lib/server/menuEditorAuth";
import { prisma } from "../../../../../lib/server/prisma";
import type { MenuIngredientOverrideLine } from "../../../../../lib/menu/menuIngredientOverridesTypes";
import {
  readAllMenuIngredientOverridesForRestaurant,
  replaceMenuIngredientOverridesForLocale,
} from "../../../../../lib/server/menuIngredientOverrides";

export const dynamic = "force-dynamic";

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

    const byLocale = await readAllMenuIngredientOverridesForRestaurant(restaurantId);
    return NextResponse.json({ ok: true, restaurantId, byLocale });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
}

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
    const localeRaw = typeof o.locale === "string" ? o.locale.trim() : "";
    if (!restaurantId || !localeRaw) {
      return NextResponse.json({ ok: false, error: "Missing restaurantId/locale" }, { status: 400 });
    }

    if (!(await canEditMenuForRestaurant(session, cookieHeader, restaurantId))) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const itemsRaw = o.items;
    const items: Record<string, MenuIngredientOverrideLine[]> = {};
    if (itemsRaw != null && typeof itemsRaw === "object" && !Array.isArray(itemsRaw)) {
      for (const [k, v] of Object.entries(itemsRaw as Record<string, unknown>)) {
        const id = k.trim();
        if (!id) continue;
        if (!Array.isArray(v)) continue;
        items[id] = (v as unknown[]).filter((x) => x != null) as MenuIngredientOverrideLine[];
      }
    }

    const locale = localeRaw.trim().toLowerCase();

    const isEnabled = await prisma.appLocale.findFirst({ where: { code: locale, enabled: 1 }, select: { code: true } });
    if (!isEnabled?.code) return NextResponse.json({ ok: false, error: "Invalid locale" }, { status: 400 });

    const exists = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } });
    if (!exists?.id) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    await replaceMenuIngredientOverridesForLocale(restaurantId, locale, items, session.userId, nowIso());
    const byLocale = await readAllMenuIngredientOverridesForRestaurant(restaurantId);
    return NextResponse.json({ ok: true, restaurantId, byLocale });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
}

