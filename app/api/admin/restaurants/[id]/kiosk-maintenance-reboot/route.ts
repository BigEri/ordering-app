import { NextResponse } from "next/server";

import { requireAdminSession } from "../../../../../../lib/server/adminGuard";
import {
  normalizeKioskMaintenanceRebootHour,
  normalizeKioskMaintenanceRebootMinute,
  resolveKioskMaintenanceRebootSchedule,
} from "../../../../../../lib/server/kioskMaintenanceReboot";
import { prisma } from "../../../../../../lib/server/prisma";

export const dynamic = "force-dynamic";

/**
 * Superadmin: místní hodina/minuta týdenního údržbového restartu kiosk tabletů.
 * Tablety stáhnou hodnotu přes /api/devices/config.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession(req.headers.get("cookie"));
    if (session.globalRole !== "SUPER_ADMIN") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const restaurantId = typeof id === "string" ? id.trim() : "";
    if (!restaurantId) {
      return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    }

    const row = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: {
        id: true,
        kioskMaintenanceRebootHour: true,
        kioskMaintenanceRebootMinute: true,
      },
    });
    if (!row) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const schedule = resolveKioskMaintenanceRebootSchedule(
      row.kioskMaintenanceRebootHour,
      row.kioskMaintenanceRebootMinute,
    );

    return NextResponse.json({
      ok: true,
      hour: schedule.hour,
      minute: schedule.minute,
      isDefault:
        row.kioskMaintenanceRebootHour == null && row.kioskMaintenanceRebootMinute == null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession(req.headers.get("cookie"));
    if (session.globalRole !== "SUPER_ADMIN") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const restaurantId = typeof id === "string" ? id.trim() : "";
    if (!restaurantId) {
      return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = (await req.json()) as unknown;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }

    const o = body as Record<string, unknown>;
    const hour = normalizeKioskMaintenanceRebootHour(o.hour);
    const minute =
      o.minute === undefined || o.minute === null
        ? 0
        : normalizeKioskMaintenanceRebootMinute(o.minute);
    if (hour === null) {
      return NextResponse.json(
        { ok: false, error: "Hodina musí být celé číslo 0–23" },
        { status: 400 },
      );
    }
    if (minute === null) {
      return NextResponse.json(
        { ok: false, error: "Minuta musí být celé číslo 0–59" },
        { status: 400 },
      );
    }

    const exists = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true },
    });
    if (!exists?.id) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        kioskMaintenanceRebootHour: hour,
        kioskMaintenanceRebootMinute: minute,
      },
    });

    return NextResponse.json({ ok: true, hour, minute, isDefault: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}
