import { NextRequest, NextResponse } from "next/server";

import {
  getDeviceApkUpdateNonce,
  getDeviceRebootNonce,
  getDeviceReloadNonce,
  getEffectiveTable,
  recordKioskTelemetry,
} from "../../../../lib/server/deviceRegistry";
import { parseKioskBatteryQuery } from "../../../../lib/server/kioskBatteryTelemetry";
import { getKioskAppRelease } from "../../../../lib/server/kioskAppRelease";
import { ensureKioskDeviceSecret } from "../../../../lib/server/kioskDeviceBindings";
import { resolveKioskMaintenanceRebootSchedule } from "../../../../lib/server/kioskMaintenanceReboot";
import { prisma } from "../../../../lib/server/prisma";

/** Konfigurace stolu se mění; bez toho tablety agresivně cachují GET a nevidí změny z adminu. */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store, no-cache, must-revalidate" };

export async function GET(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get("deviceId")?.trim() ?? "";
  if (!deviceId) {
    return NextResponse.json({ ok: false, error: "deviceId required" }, { status: 400, headers: NO_STORE });
  }

  const apkVersionRaw = req.nextUrl.searchParams.get("apkVersionCode")?.trim() ?? "";
  const apkVersionCode = Number.parseInt(apkVersionRaw, 10);
  const battery = parseKioskBatteryQuery({
    batteryPercent: req.nextUrl.searchParams.get("batteryPercent"),
    batteryCharging: req.nextUrl.searchParams.get("batteryCharging"),
  });
  const hasApk = Number.isFinite(apkVersionCode) && apkVersionCode > 0;
  if (hasApk || battery) {
    recordKioskTelemetry(deviceId, {
      ...(hasApk ? { apkVersionCode } : {}),
      ...(battery
        ? { batteryPercent: battery.percent, batteryCharging: battery.charging }
        : {}),
    });
  }

  // Strict mode: binding exists only if it's stored in DB (kiosk_device_bindings).
  // Presence fallback would make "removed device" still look paired.
  const [t, reloadNonce, apkUpdateNonce, rebootNonce] = await Promise.all([
    getEffectiveTable(deviceId, { allowFallback: false }),
    getDeviceReloadNonce(deviceId),
    getDeviceApkUpdateNonce(deviceId),
    getDeviceRebootNonce(deviceId),
  ]);
  const appRelease = getKioskAppRelease();

  if (!t) {
    return NextResponse.json(
      { ok: true, binding: null, reloadNonce, apkUpdateNonce, rebootNonce, appRelease },
      { headers: NO_STORE },
    );
  }

  const [deviceSecret, restaurantRow] = await Promise.all([
    ensureKioskDeviceSecret(deviceId),
    t.restaurantId
      ? prisma.restaurant.findUnique({
          where: { id: t.restaurantId },
          select: {
            name: true,
            kioskServicePinSalt: true,
            kioskServicePinHash: true,
            kioskMaintenanceRebootHour: true,
            kioskMaintenanceRebootMinute: true,
          },
        })
      : Promise.resolve(null),
  ]);

  const servicePinSalt = restaurantRow?.kioskServicePinSalt?.trim() || null;
  const servicePinHash = restaurantRow?.kioskServicePinHash?.trim() || null;
  const hasServicePin = Boolean(servicePinSalt && servicePinHash);
  const maintenanceReboot = resolveKioskMaintenanceRebootSchedule(
    restaurantRow?.kioskMaintenanceRebootHour,
    restaurantRow?.kioskMaintenanceRebootMinute,
  );

  return NextResponse.json(
    {
      ok: true,
      binding: {
        tableId: t.tableId,
        tableLabel: t.tableLabel,
        restaurantId: t.restaurantId || null,
        restaurantName: restaurantRow?.name?.trim() || null,
        deviceSecret: deviceSecret ?? null,
      },
      reloadNonce,
      apkUpdateNonce,
      rebootNonce,
      appRelease,
      maintenanceRebootHour: maintenanceReboot.hour,
      maintenanceRebootMinute: maintenanceReboot.minute,
      ...(hasServicePin ? { servicePinSalt, servicePinHash } : {}),
    },
    { headers: NO_STORE },
  );
}
