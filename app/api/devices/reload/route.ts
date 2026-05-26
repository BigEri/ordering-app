import { NextRequest, NextResponse } from "next/server";

import { requireAdminSession, type AdminSession } from "../../../../lib/server/adminGuard";
import {
  activeRestaurantCookieName,
  userHasRestaurantAccess,
} from "../../../../lib/server/auth";
import { bumpDeviceReloadNonce } from "../../../../lib/server/deviceRegistry";
import { cookieValueFromHeader } from "../../../../lib/server/httpCookie";
import { getKioskDeviceBinding } from "../../../../lib/server/kioskDeviceBindings";

export const dynamic = "force-dynamic";

/** Admin: vynutí obnovení stránky na tabletu (zvýší reloadNonce v /api/devices/config). */
export async function POST(req: NextRequest) {
  let body: { deviceId?: string } = {};
  try {
    body = (await req.json()) as { deviceId?: string };
  } catch {
    /* ignore */
  }
  const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
  if (!deviceId) {
    return NextResponse.json({ ok: false, error: "deviceId required" }, { status: 400 });
  }

  const cookieHeader = req.headers.get("cookie");
  let session: AdminSession;
  try {
    session = await requireAdminSession(cookieHeader);
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const binding = await getKioskDeviceBinding(deviceId);
  if (!binding) {
    return NextResponse.json({ ok: false, error: "Neznámé nebo nespárované zařízení." }, { status: 404 });
  }

  const rid = cookieValueFromHeader(cookieHeader, activeRestaurantCookieName()).trim();
  if (!rid) {
    return NextResponse.json(
      { ok: false, error: "Vyberte aktivní provozovnu (cookie oa_rid)." },
      { status: 400 },
    );
  }
  if (session.globalRole !== "SUPER_ADMIN" && !(await userHasRestaurantAccess(session.userId, rid)).ok) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (rid !== binding.restaurantId) {
    return NextResponse.json(
      { ok: false, error: "Zařízení nepatří do aktivní provozovny." },
      { status: 403 },
    );
  }

  const reloadNonce = await bumpDeviceReloadNonce(deviceId);
  return NextResponse.json({ ok: true, deviceId, reloadNonce });
}
