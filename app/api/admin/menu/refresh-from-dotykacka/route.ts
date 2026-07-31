import { NextResponse } from "next/server";

import { fetchDotykackaProductsForMenuCached } from "../../../../../lib/dotykacka/fetchProductsCached";
import { invalidateDotykackaMenuCache } from "../../../../../lib/dotykacka/menuCache";
import { requireAdminSession } from "../../../../../lib/server/adminGuard";
import { activeRestaurantCookieName, userHasRestaurantAccess } from "../../../../../lib/server/auth";
import { bumpDeviceReloadNonce } from "../../../../../lib/server/deviceRegistry";
import { cookieValueFromHeader } from "../../../../../lib/server/httpCookie";
import { listAllKioskDeviceBindings } from "../../../../../lib/server/kioskDeviceBindings";

export const dynamic = "force-dynamic";

/**
 * Admin: zruší cache menu z Dotykačky a volitelně vynutí obnovení všech tabletů provozovny.
 * Body: { restaurantId?: string, bumpDevices?: boolean } — restaurantId z URL kontextu má přednost před cookie.
 */
export async function POST(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  let session;
  try {
    session = await requireAdminSession(cookieHeader);
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let bumpDevices = true;
  let fromBody = "";
  try {
    const body = (await req.json()) as { bumpDevices?: boolean; restaurantId?: string };
    if (body && typeof body.bumpDevices === "boolean") bumpDevices = body.bumpDevices;
    if (body && typeof body.restaurantId === "string") fromBody = body.restaurantId.trim();
  } catch {
    /* prázdné tělo = výchozí bumpDevices true */
  }

  const fromCookie = cookieValueFromHeader(cookieHeader, activeRestaurantCookieName()).trim();
  const restaurantId = fromBody || fromCookie;
  if (!restaurantId) {
    return NextResponse.json(
      { ok: false, error: "Nejdřív dokončete nastavení v Přehledu administrace." },
      { status: 400 },
    );
  }

  if (session.globalRole !== "SUPER_ADMIN") {
    const access = await userHasRestaurantAccess(session.userId, restaurantId);
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
  }

  invalidateDotykackaMenuCache(restaurantId);

  const prefetch = await fetchDotykackaProductsForMenuCached(restaurantId);

  let devicesNotified = 0;
  if (bumpDevices) {
    const bindings = await listAllKioskDeviceBindings();
    for (const b of bindings) {
      if (b.restaurantId.trim() !== restaurantId) continue;
      await bumpDeviceReloadNonce(b.deviceId);
      devicesNotified += 1;
    }
  }

  if (!prefetch.ok) {
    return NextResponse.json({
      ok: true,
      restaurantId,
      devicesNotified,
      menuPrefetchOk: false,
      menuPrefetchError: prefetch.error,
    });
  }

  return NextResponse.json({
    ok: true,
    restaurantId,
    devicesNotified,
    menuPrefetchOk: true,
    sectionCount: prefetch.sections.length,
  });
}
