import { NextResponse } from "next/server";

import { requireAdminSession } from "../../../../../lib/server/adminGuard";
import { nowIso } from "../../../../../lib/server/db";
import { canEditMenuForRestaurant } from "../../../../../lib/server/menuEditorAuth";
import { isAllowedStoredImageUrl, tryDeleteLocalMenuImageFile } from "../../../../../lib/server/menuImageStorage";
import { prisma } from "../../../../../lib/server/prisma";

export const dynamic = "force-dynamic";

const MAX_URL = 2000;

export async function PATCH(req: Request): Promise<NextResponse> {
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
    const menuItemId = typeof o.menuItemId === "string" ? o.menuItemId.trim() : "";
    const imageUrlRaw = o.imageUrl;
    const imageUrl = imageUrlRaw === null || imageUrlRaw === undefined ? null : typeof imageUrlRaw === "string" ? imageUrlRaw.trim() : "";

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

    const prevRow = await prisma.menuImage.findUnique({
      where: { restaurantId_menuItemId: { restaurantId, menuItemId } },
      select: { imageUrl: true },
    });
    const previousUrl = prevRow?.imageUrl ?? null;

    if (imageUrl === null || imageUrl === "") {
      await prisma.menuImage.deleteMany({ where: { restaurantId, menuItemId } });
      await tryDeleteLocalMenuImageFile(previousUrl);
      return NextResponse.json({ ok: true, cleared: true });
    }

    if (!isAllowedStoredImageUrl(imageUrl, restaurantId, MAX_URL)) {
      return NextResponse.json(
        { ok: false, error: "Invalid imageUrl (https URL nebo /uploads/menu/…, max length)" },
        { status: 400 },
      );
    }

    const ts = nowIso();
    await prisma.menuImage.upsert({
      where: { restaurantId_menuItemId: { restaurantId, menuItemId } },
      update: { imageUrl, imagePublicId: null, updatedAtIso: ts, updatedByUserId: session.userId },
      create: {
        restaurantId,
        menuItemId,
        imageUrl,
        imagePublicId: null,
        updatedAtIso: ts,
        updatedByUserId: session.userId,
      },
    });

    if (previousUrl && previousUrl !== imageUrl) {
      await tryDeleteLocalMenuImageFile(previousUrl);
    }

    return NextResponse.json({ ok: true, imageUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}
