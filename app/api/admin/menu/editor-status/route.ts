import { NextResponse } from "next/server";

import { requireAdminSession } from "../../../../../lib/server/adminGuard";
import { activeRestaurantCookieName, userHasRestaurantAccess } from "../../../../../lib/server/auth";
import { getDefaultPublicMenuRestaurantId } from "../../../../../lib/server/publicRestaurantName";

export const dynamic = "force-dynamic";

function cookieValue(cookieHeader: string | null | undefined, name: string): string {
  const raw = typeof cookieHeader === "string" ? cookieHeader : "";
  if (!raw) return "";
  const parts = raw.split(";").map((p) => p.trim());
  const hit = parts.find((p) => p.startsWith(`${name}=`));
  if (!hit) return "";
  return hit.slice(`${name}=`.length);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("restaurantId")?.trim() ?? "";
  const publicId = await getDefaultPublicMenuRestaurantId();
  const restaurantId = q || publicId || "";
  if (!restaurantId) {
    return NextResponse.json({ ok: true, canEdit: false, reason: "no_public_restaurant" });
  }

  const cookieHeader = req.headers.get("cookie");
  const activeRid = cookieValue(cookieHeader, activeRestaurantCookieName());
  if (activeRid !== restaurantId) {
    return NextResponse.json({
      ok: true,
      canEdit: false,
      reason: activeRid ? "active_mismatch" : "no_active",
      restaurantId,
    });
  }

  try {
    const session = await requireAdminSession(cookieHeader);
    if (session.globalRole === "SUPER_ADMIN") {
      return NextResponse.json({ ok: true, canEdit: true, restaurantId });
    }
    const access = await userHasRestaurantAccess(session.userId, restaurantId);
    if (!access.ok) {
      return NextResponse.json({ ok: true, canEdit: false, reason: "no_membership", restaurantId });
    }
    return NextResponse.json({ ok: true, canEdit: true, restaurantId });
  } catch {
    return NextResponse.json({ ok: true, canEdit: false, reason: "unauthorized", restaurantId });
  }
}
