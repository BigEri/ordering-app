import { NextResponse } from "next/server";

import type { AdminSession } from "../../../../../lib/server/adminGuard";
import { requireAdminSession, requireActiveRestaurantId } from "../../../../../lib/server/adminGuard";
import { prisma } from "../../../../../lib/server/prisma";
import { getActivePairingCodeRowAsync, markPairingCodeUsedAsync } from "../../../../../lib/server/devicePairingCodes";
import { setAdminBinding } from "../../../../../lib/server/deviceRegistry";
import { checkRateLimit, clientIpFromRequest } from "../../../../../lib/server/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { code?: string; tableId?: string; tableLabel?: string; restaurantId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const codeRaw = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const tableId = typeof body.tableId === "string" ? body.tableId.trim() : "";
  const tableLabel = typeof body.tableLabel === "string" ? body.tableLabel.trim() : "";
  let restaurantIdRaw = typeof body.restaurantId === "string" ? body.restaurantId.trim() : "";

  if (!codeRaw || !tableId || !tableLabel) {
    return NextResponse.json({ ok: false, error: "code, tableId, tableLabel required" }, { status: 400 });
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
      { ok: false, error: "Vyberte aktivní provozovnu nebo zadejte restaurantId." },
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

  const ip = clientIpFromRequest(req);
  const rl = checkRateLimit(`pair-by-code:${ip}`, 40, 15 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const row = await getActivePairingCodeRowAsync(codeRaw);
  if (!row) {
    return NextResponse.json({ ok: false, error: "Neplatný nebo expirovaný kód." }, { status: 400 });
  }

  const { deviceSecret } = await setAdminBinding(row.deviceId, tableId, tableLabel, restaurantIdRaw);
  await markPairingCodeUsedAsync(codeRaw);

  return NextResponse.json({ ok: true, deviceId: row.deviceId, deviceSecret });
}
