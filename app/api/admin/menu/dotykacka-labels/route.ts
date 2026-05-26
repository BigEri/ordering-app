import { NextResponse } from "next/server";

import { requireAdminSession } from "../../../../../lib/server/adminGuard";
import { nowIso } from "../../../../../lib/server/db";
import { canEditMenuForRestaurant } from "../../../../../lib/server/menuEditorAuth";
import { prisma } from "../../../../../lib/server/prisma";
import {
  readDotykackaLabelsForRestaurantLocale,
  replaceDotykackaLabelsForRestaurantLocale,
  type DotykackaLabelPayload,
} from "../../../../../lib/server/menuDotykackaLabels";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await requireAdminSession(req.headers.get("cookie"));
    const cookieHeader = req.headers.get("cookie");
    const url = new URL(req.url);
    const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
    const localeRaw = url.searchParams.get("locale")?.trim() ?? "cs";
    if (!restaurantId) return NextResponse.json({ ok: false, error: "Missing restaurantId" }, { status: 400 });

    if (!(await canEditMenuForRestaurant(session, cookieHeader, restaurantId))) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const exists = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } });
    if (!exists?.id) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    const localeCandidate = localeRaw.trim().toLowerCase() || "cs";
    const isEnabled = await prisma.appLocale.findFirst({
      where: { code: localeCandidate, enabled: 1 },
      select: { code: true },
    });
    const locale = isEnabled?.code ? localeCandidate : "cs";

    const payload = await readDotykackaLabelsForRestaurantLocale(restaurantId, locale);
    return NextResponse.json({ ok: true, restaurantId, locale, ...payload });
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
    const groupsRaw = o.groups;
    const optionsRaw = o.options;
    if (!restaurantId || !localeRaw) return NextResponse.json({ ok: false, error: "Missing restaurantId/locale" }, { status: 400 });

    if (!(await canEditMenuForRestaurant(session, cookieHeader, restaurantId))) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const groups: Record<string, string> = {};
    const options: Record<string, string> = {};
    if (groupsRaw && typeof groupsRaw === "object" && !Array.isArray(groupsRaw)) {
      for (const [k, v] of Object.entries(groupsRaw as Record<string, unknown>)) {
        const id = k.trim();
        const label = typeof v === "string" ? v.trim() : "";
        if (id) groups[id] = label;
      }
    }
    if (optionsRaw && typeof optionsRaw === "object" && !Array.isArray(optionsRaw)) {
      for (const [k, v] of Object.entries(optionsRaw as Record<string, unknown>)) {
        const id = k.trim();
        const label = typeof v === "string" ? v.trim() : "";
        if (id) options[id] = label;
      }
    }

    const locale = localeRaw.trim().toLowerCase();
    const isEnabled = await prisma.appLocale.findFirst({ where: { code: locale, enabled: 1 }, select: { code: true } });
    if (!isEnabled?.code) return NextResponse.json({ ok: false, error: "Invalid locale" }, { status: 400 });

    const exists = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } });
    if (!exists?.id) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    await replaceDotykackaLabelsForRestaurantLocale(
      restaurantId,
      locale,
      { groups, options } satisfies DotykackaLabelPayload,
      session.userId,
      nowIso(),
    );
    const payload = await readDotykackaLabelsForRestaurantLocale(restaurantId, locale);
    return NextResponse.json({ ok: true, restaurantId, locale, ...payload });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
}

