import { NextRequest, NextResponse } from "next/server";

import { requireAdminSession, type AdminSession } from "../../../../lib/server/adminGuard";
import {
  activeRestaurantCookieName,
  userHasRestaurantAccess,
} from "../../../../lib/server/auth";
import { bumpDeviceRebootNonce } from "../../../../lib/server/deviceRegistry";
import { cookieValueFromHeader } from "../../../../lib/server/httpCookie";
import { getKioskDeviceBinding } from "../../../../lib/server/kioskDeviceBindings";

export const dynamic = "force-dynamic";

/** SUPER_ADMIN: okamžitý DO reboot tabletu (rebootNonce v /api/devices/config). */
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

  if (session.globalRole !== "SUPER_ADMIN") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const binding = await getKioskDeviceBinding(deviceId);
  if (!binding) {
    return NextResponse.json({ ok: false, error: "Neznámé nebo nespárované zařízení." }, { status: 404 });
  }

  const rid = cookieValueFromHeader(cookieHeader, activeRestaurantCookieName()).trim();
  if (rid && rid !== binding.restaurantId) {
    return NextResponse.json(
      { ok: false, error: "Zařízení nepatří k vybrané restauraci." },
      { status: 403 },
    );
  }
  // Allow when cookie matches or when URL/body restaurant context already validated via binding.
  if (rid && !(await userHasRestaurantAccess(session.userId, rid)).ok && session.globalRole !== "SUPER_ADMIN") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const rebootNonce = await bumpDeviceRebootNonce(deviceId);
  return NextResponse.json({ ok: true, deviceId, rebootNonce });
}
