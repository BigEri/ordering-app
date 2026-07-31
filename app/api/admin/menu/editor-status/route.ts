import { NextResponse } from "next/server";

import { requireAdminSession } from "../../../../../lib/server/adminGuard";
import { activeRestaurantCookieName, userHasRestaurantAccess } from "../../../../../lib/server/auth";
import { cookieValueFromHeader } from "../../../../../lib/server/httpCookie";
import { resolveAdminMenuRestaurantIdForSession } from "../../../../../lib/server/publicMenuRestaurantResolve";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("restaurantId")?.trim() ?? "";
  const cookieHeader = req.headers.get("cookie");
  const activeRid = cookieValueFromHeader(cookieHeader, activeRestaurantCookieName());

  let session;
  try {
    session = await requireAdminSession(cookieHeader);
  } catch {
    return NextResponse.json({ ok: true, canEdit: false, reason: "unauthorized" });
  }

  const scopedRid = await resolveAdminMenuRestaurantIdForSession(session, activeRid || null);
  /** Prefer explicit restaurant from URL context (superadmin viewing A while cookie may be B). */
  const restaurantId = q || scopedRid || "";
  if (!restaurantId) {
    return NextResponse.json({ ok: true, canEdit: false, reason: "no_public_restaurant" });
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
