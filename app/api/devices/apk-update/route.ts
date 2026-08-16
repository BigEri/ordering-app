import { NextRequest, NextResponse } from "next/server";

import { requireAdminSession, type AdminSession } from "../../../../lib/server/adminGuard";
import { userHasRestaurantAccess } from "../../../../lib/server/auth";
import { bumpDeviceApkUpdateNonce } from "../../../../lib/server/deviceRegistry";
import { getKioskAppRelease } from "../../../../lib/server/kioskAppRelease";
import { getKioskDeviceBinding } from "../../../../lib/server/kioskDeviceBindings";

export const dynamic = "force-dynamic";

/** Admin: požádá kiosk tablet o stažení APK (apkUpdateNonce v /api/devices/config). */
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

  const release = getKioskAppRelease();
  if (!release) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Kiosk APK není na serveru nakonfigurováno (KIOSK_APK_VERSION_CODE, KIOSK_APK_URL). Viz docs/KIOSK-APK-UPDATE.md.",
      },
      { status: 503 },
    );
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

  if (
    session.globalRole !== "SUPER_ADMIN" &&
    !(await userHasRestaurantAccess(session.userId, binding.restaurantId)).ok
  ) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const apkUpdateNonce = await bumpDeviceApkUpdateNonce(deviceId);
  return NextResponse.json({
    ok: true,
    deviceId,
    apkUpdateNonce,
    release: { versionCode: release.versionCode, versionName: release.versionName },
  });
}
