import { NextResponse } from "next/server";

import { requireAdminSession } from "../../../../../lib/server/adminGuard";
import { canEditMenuForRestaurant } from "../../../../../lib/server/menuEditorAuth";
import { prisma } from "../../../../../lib/server/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = requireAdminSession(req.headers.get("cookie"));
    const cookieHeader = req.headers.get("cookie");
    const url = new URL(req.url);
    const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
    if (!restaurantId) return NextResponse.json({ ok: false, error: "Missing restaurantId" }, { status: 400 });

    if (!(await canEditMenuForRestaurant(session, cookieHeader, restaurantId))) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const rows = await prisma.menuImage.findMany({
      where: { restaurantId, imageUrl: { not: "" } },
      orderBy: { updatedAtIso: "desc" },
      select: { menuItemId: true, imageUrl: true, updatedAtIso: true },
    });

    const images = rows
      .map((r) => ({
        menuItemId: typeof r.menuItemId === "string" ? r.menuItemId.trim() : "",
        imageUrl: typeof r.imageUrl === "string" ? r.imageUrl.trim() : "",
        updatedAtIso: typeof r.updatedAtIso === "string" ? r.updatedAtIso : "",
      }))
      .filter((r) => r.menuItemId && r.imageUrl);

    return NextResponse.json({ ok: true, restaurantId, images });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
}

