import { NextResponse } from "next/server";

import { requireAdminSession } from "../../../../../lib/server/adminGuard";
import { activeRestaurantCookieName, userHasRestaurantAccess } from "../../../../../lib/server/auth";
import { resolveAdminMenuRestaurantIdForSession } from "../../../../../lib/server/publicMenuRestaurantResolve";

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
  const cookieHeader = req.headers.get("cookie");
  const activeRid = cookieValue(cookieHeader, activeRestaurantCookieName());

  let session;
  try {
    session = await requireAdminSession(cookieHeader);
  } catch {
    return NextResponse.json({ ok: true, canEdit: false, reason: "unauthorized" });
  }

  const scopedRid = await resolveAdminMenuRestaurantIdForSession(session, activeRid || null);
  const restaurantId = q || scopedRid || "";
  if (!restaurantId) {
    return NextResponse.json({ ok: true, canEdit: false, reason: "no_public_restaurant" });
  }

  if (scopedRid && restaurantId !== scopedRid) {
    return NextResponse.json({
      ok: true,
      canEdit: false,
      reason: "active_mismatch",
      restaurantId,
    });
  }

  if (!scopedRid) {
    return NextResponse.json({
      ok: true,
      canEdit: false,
      reason: activeRid ? "active_mismatch" : "no_active",
      restaurantId,
    });
  }

  if (session.globalRole === "SUPER_ADMIN") {
    return NextResponse.json({ ok: true, canEdit: true, restaurantId });
  }

  const access = await userHasRestaurantAccess(session.userId, restaurantId);
  if (!access.ok) {
    return NextResponse.json({ ok: true, canEdit: false, reason: "no_membership", restaurantId });
  }
  return NextResponse.json({ ok: true, canEdit: true, restaurantId });
}
