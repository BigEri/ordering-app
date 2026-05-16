import { NextResponse } from "next/server";

import { getKioskDeviceBinding } from "../../../../lib/server/kioskDeviceBindings";
import {
  PUBLIC_MENU_RESTAURANT_COOKIE,
  restaurantExistsInDb,
} from "../../../../lib/server/publicMenuRestaurantResolve";

export const dynamic = "force-dynamic";

const MAX_AGE_SEC = 60 * 60 * 24 * 400;

/**
 * Po načtení `/api/devices/config` s `restaurantId` u párovaného zařízení zavolá klient POST s `deviceId`.
 * Nastaví cookie `oa_menu_rid` — další načtení `/menu` bere fotky a úpravy pro tuto provozovnu.
 */
export async function POST(req: Request) {
  let body: { deviceId?: string };
  try {
    body = (await req.json()) as { deviceId?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
  if (!deviceId) {
    return NextResponse.json({ ok: false, error: "deviceId required" }, { status: 400 });
  }

  const row = await getKioskDeviceBinding(deviceId);
  if (!row) {
    return NextResponse.json({ ok: false, error: "Zařízení nemá uloženou vazbu v administraci." }, { status: 404 });
  }
  if (!(await restaurantExistsInDb(row.restaurantId))) {
    return NextResponse.json({ ok: false, error: "Neplatná restaurace" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, restaurantId: row.restaurantId });
  res.cookies.set(PUBLIC_MENU_RESTAURANT_COOKIE, row.restaurantId, {
    path: "/",
    maxAge: MAX_AGE_SEC,
    sameSite: "lax",
    httpOnly: false,
  });
  return res;
}
