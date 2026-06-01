import { NextRequest, NextResponse } from "next/server";

import type { AdminSession } from "../../../../lib/server/adminGuard";
import { requireAdminSession, requireActiveRestaurantId } from "../../../../lib/server/adminGuard";
import { bumpDeviceReloadNonce, setAdminBinding } from "../../../../lib/server/deviceRegistry";
import { prisma } from "../../../../lib/server/prisma";

export async function POST(req: NextRequest) {
  let body: { deviceId?: string; tableId?: string; tableLabel?: string; restaurantId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
  const tableId = typeof body.tableId === "string" ? body.tableId.trim() : "";
  const tableLabel = typeof body.tableLabel === "string" ? body.tableLabel.trim() : "";
  let restaurantIdRaw = typeof body.restaurantId === "string" ? body.restaurantId.trim() : "";

  if (!deviceId || !tableId || !tableLabel) {
    return NextResponse.json({ ok: false, error: "deviceId, tableId, tableLabel required" }, { status: 400 });
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

  if (!restaurantIdRaw) {
    return NextResponse.json(
      { ok: false, error: "Chybí restaurantId — nejdřív dokončete nastavení v Přehledu administrace." },
      { status: 400 },
    );
  }

  const restaurantExists = await prisma.restaurant.findUnique({ where: { id: restaurantIdRaw }, select: { id: true } });
  if (!restaurantExists) {
    return NextResponse.json({ ok: false, error: "Neplatná restaurace" }, { status: 400 });
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

  const { deviceSecret } = await setAdminBinding(deviceId, tableId, tableLabel, restaurantIdRaw);
  await bumpDeviceReloadNonce(deviceId);

  return NextResponse.json({ ok: true, deviceSecret });
}
