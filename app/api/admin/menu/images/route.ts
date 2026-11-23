import { NextResponse } from "next/server";

import { fetchRestaurantMenuCached } from "../../../../../lib/menu/fetchRestaurantMenu";
import { requireAdminSession } from "../../../../../lib/server/adminGuard";
import { canEditMenuForRestaurant } from "../../../../../lib/server/menuEditorAuth";
import { prisma } from "../../../../../lib/server/prisma";

export const dynamic = "force-dynamic";

type PickerImage = {
  menuItemId: string;
  imageUrl: string;
  name: string;
  /** `upload` = nahráno v TableFlow, `pos` = fotka u produktu v pokladně (Storyous / Dotykačka). */
  source: "upload" | "pos";
  updatedAtIso: string;
};

export async function GET(req: Request) {
  try {
    const session = await requireAdminSession(req.headers.get("cookie"));
    const cookieHeader = req.headers.get("cookie");
    const url = new URL(req.url);
    const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
    if (!restaurantId) return NextResponse.json({ ok: false, error: "Missing restaurantId" }, { status: 400 });

    if (!(await canEditMenuForRestaurant(session, cookieHeader, restaurantId))) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const [rows, menu] = await Promise.all([
      prisma.menuImage.findMany({
        where: { restaurantId, imageUrl: { not: "" } },
        orderBy: { updatedAtIso: "desc" },
        select: { menuItemId: true, imageUrl: true, updatedAtIso: true },
      }),
      fetchRestaurantMenuCached(restaurantId).catch(() => null),
    ]);

    const posItems = menu?.ok ? menu.sections.flatMap((s) => s.items) : [];
    const nameById = new Map(posItems.map((it) => [it.id, it.name]));

    const uploads: PickerImage[] = rows
      .map((r) => {
        const menuItemId = typeof r.menuItemId === "string" ? r.menuItemId.trim() : "";
        return {
          menuItemId,
          imageUrl: typeof r.imageUrl === "string" ? r.imageUrl.trim() : "",
          name: nameById.get(menuItemId) ?? "",
          source: "upload" as const,
          updatedAtIso: typeof r.updatedAtIso === "string" ? r.updatedAtIso : "",
        };
      })
      .filter((r) => r.menuItemId && r.imageUrl);

    const overridden = new Set(uploads.map((u) => u.menuItemId));
    const seenUrls = new Set(uploads.map((u) => u.imageUrl));
    const fromPos: PickerImage[] = [];
    for (const it of posItems) {
      const imageUrl = it.imageUrl?.trim() ?? "";
      if (!imageUrl || overridden.has(it.id) || seenUrls.has(imageUrl)) continue;
      seenUrls.add(imageUrl);
      fromPos.push({ menuItemId: it.id, imageUrl, name: it.name, source: "pos", updatedAtIso: "" });
    }

    return NextResponse.json({ ok: true, restaurantId, images: [...uploads, ...fromPos] });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
}
