import { NextResponse } from "next/server";

import { requireAdminSession } from "../../../../../lib/server/adminGuard";
import { nowIso } from "../../../../../lib/server/db";
import {
  isEnabledLocale,
  readAllMenuTextOverridesForRestaurant,
  replaceMenuTextOverridesForLocale,
  type MenuTextOverrideCategoryPayload,
  type MenuTextOverrideItemPayload,
} from "../../../../../lib/server/menuTextOverrides";
import { canEditMenuForRestaurant } from "../../../../../lib/server/menuEditorAuth";
import { prisma } from "../../../../../lib/server/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = requireAdminSession(req.headers.get("cookie"));
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

    const byLocale = await readAllMenuTextOverridesForRestaurant(restaurantId);
    return NextResponse.json({ ok: true, restaurantId, byLocale });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = requireAdminSession(req.headers.get("cookie"));
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
    const categoriesRaw = o.categories;
    const items: Record<string, MenuTextOverrideItemPayload> = {};
    const categories: Record<string, MenuTextOverrideCategoryPayload> = {};

    if (itemsRaw != null && typeof itemsRaw === "object" && !Array.isArray(itemsRaw)) {
      for (const [k, v] of Object.entries(itemsRaw as Record<string, unknown>)) {
        if (!k.trim()) continue;
        if (!v || typeof v !== "object" || Array.isArray(v)) continue;
        const iv = v as Record<string, unknown>;
        const entry: MenuTextOverrideItemPayload = {};
        if (typeof iv.name === "string") entry.name = iv.name;
        if ("description" in iv) {
          entry.description = typeof iv.description === "string" ? iv.description : undefined;
        }
        items[k.trim()] = entry;
      }
    }

    if (categoriesRaw != null && typeof categoriesRaw === "object" && !Array.isArray(categoriesRaw)) {
      for (const [k, v] of Object.entries(categoriesRaw as Record<string, unknown>)) {
        if (!k.trim()) continue;
        if (!v || typeof v !== "object" || Array.isArray(v)) continue;
        const cv = v as Record<string, unknown>;
        if (typeof cv.name === "string") categories[k.trim()] = { name: cv.name };
      }
    }

    if (!(await isEnabledLocale(localeRaw))) {
      return NextResponse.json({ ok: false, error: "Invalid locale" }, { status: 400 });
    }
    const locale = localeRaw.trim().toLowerCase();
    const exists = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } });
    if (!exists?.id) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    await replaceMenuTextOverridesForLocale(
      restaurantId,
      locale,
      items,
      categories,
      session.userId,
      nowIso(),
    );

    const byLocale = await readAllMenuTextOverridesForRestaurant(restaurantId);
    return NextResponse.json({ ok: true, restaurantId, byLocale });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
}
