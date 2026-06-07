import { NextResponse } from "next/server";

import { fetchDotykackaProductsForMenuCached } from "../../../../../lib/dotykacka/fetchProductsCached";
import { invalidateDotykackaMenuCache } from "../../../../../lib/dotykacka/menuCache";
import { requireAdminSession, requireActiveRestaurantId } from "../../../../../lib/server/adminGuard";
import { bumpDeviceReloadNonce } from "../../../../../lib/server/deviceRegistry";
import { listAllKioskDeviceBindings } from "../../../../../lib/server/kioskDeviceBindings";

export const dynamic = "force-dynamic";

/**
 * Admin: zruší cache menu z Dotykačky a volitelně vynutí obnovení všech tabletů provozovny.
 * Body: { bumpDevices?: boolean } — výchozí true.
 */
export async function POST(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  let session;
  try {
    session = await requireAdminSession(cookieHeader);
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let restaurantId: string;
  try {
    restaurantId = (await requireActiveRestaurantId(session, cookieHeader)).trim();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Nejdřív dokončete nastavení v Přehledu administrace." },
      { status: 400 },
    );
  }
  if (!restaurantId) {
    return NextResponse.json(
      { ok: false, error: "Nejdřív dokončete nastavení v Přehledu administrace." },
      { status: 400 },
    );
  }

  let bumpDevices = true;
  try {
    const body = (await req.json()) as { bumpDevices?: boolean };
    if (body && typeof body.bumpDevices === "boolean") bumpDevices = body.bumpDevices;
  } catch {
    /* prázdné tělo = výchozí bumpDevices true */
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
