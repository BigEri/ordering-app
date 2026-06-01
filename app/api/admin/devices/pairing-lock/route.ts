import { NextRequest, NextResponse } from "next/server";

import type { AdminSession } from "../../../../../lib/server/adminGuard";
import { requireAdminSession, requireActiveRestaurantId } from "../../../../../lib/server/adminGuard";
import { prisma } from "../../../../../lib/server/prisma";
import { getKioskDeviceBinding, setKioskDevicePairingLocked } from "../../../../../lib/server/kioskDeviceBindings";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { deviceId?: string; locked?: boolean; restaurantId?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
  const locked = Boolean(body.locked);
  let restaurantIdRaw = typeof body.restaurantId === "string" ? body.restaurantId.trim() : "";

  if (!deviceId) {
    return NextResponse.json({ ok: false, error: "deviceId required" }, { status: 400 });
  }

  let session: AdminSession;
  try {
    session = await requireAdminSession(req.headers.get("cookie"));
    if (session.globalRole === "SUPER_ADMIN") {
      if (!restaurantIdRaw) {
        restaurantIdRaw = (await requireActiveRestaurantId(session, req.headers.get("cookie"))) ?? "";
      }
    } else {
      restaurantIdRaw = await requireActiveRestaurantId(session, req.headers.get("cookie"));
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const binding = await getKioskDeviceBinding(deviceId);
  if (!binding) {
    return NextResponse.json({ ok: false, error: "Neznámé nebo nespárované zařízení." }, { status: 404 });
  }

  if (!restaurantIdRaw) {
    return NextResponse.json(
      { ok: false, error: "Nejdřív dokončete nastavení v Přehledu administrace." },
      { status: 400 },
    );
  }
  if (binding.restaurantId !== restaurantIdRaw) {
    return NextResponse.json({ ok: false, error: "Zařízení nepatří k vaší restauraci." }, { status: 403 });
  }

  if (session.globalRole !== "SUPER_ADMIN") {
    const okMem = await prisma.membership.findUnique({
      where: { userId_restaurantId: { userId: session.userId, restaurantId: restaurantIdRaw } },
      select: { userId: true },
    });
    if (!okMem) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
  }

  await setKioskDevicePairingLocked(deviceId, locked);
  return NextResponse.json({ ok: true, deviceId, locked });
}

