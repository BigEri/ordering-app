import { NextResponse } from "next/server";

import { requireAdminSession } from "../../../lib/server/adminGuard";
import {
  activeRestaurantCookieName,
  userHasRestaurantAccess,
} from "../../../lib/server/auth";
import { listDeviceRecordsForRestaurant } from "../../../lib/server/deviceRegistry";
import { getKioskAppRelease } from "../../../lib/server/kioskAppRelease";
import { cookieValueFromHeader } from "../../../lib/server/httpCookie";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const cookieHeader = req.headers.get("cookie");
    const session = await requireAdminSession(cookieHeader);
    const url = new URL(req.url);
    const fromQuery = (url.searchParams.get("restaurantId") ?? "").trim();
    const fromCookie = cookieValueFromHeader(cookieHeader, activeRestaurantCookieName()).trim();
    /** Prefer explicit restaurant from URL context (superadmin viewing A while cookie may be B). */
    const rid = fromQuery || fromCookie;
    if (!rid) {
      return NextResponse.json(
        { ok: false, error: "Nejdřív dokončete nastavení v Přehledu administrace." },
        { status: 400 },
      );
    }
    if (session.globalRole !== "SUPER_ADMIN" && !(await userHasRestaurantAccess(session.userId, rid)).ok) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    const devices = await listDeviceRecordsForRestaurant(rid);
    const kioskRelease = getKioskAppRelease();
    return NextResponse.json(
      { ok: true, devices, kioskRelease, restaurantId: rid },
      { headers: { "Cache-Control": "private, no-store, no-cache, must-revalidate" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/devices", e);
    return NextResponse.json({ ok: false, error: "Nepodařilo se načíst seznam zařízení." }, { status: 500 });
  }
}
