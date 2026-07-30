import { NextResponse } from "next/server";

import { requireAdminSession } from "../../../../../../lib/server/adminGuard";
import {
  buildKioskServicePinCredentials,
  normalizeKioskServicePin,
} from "../../../../../../lib/server/kioskServicePin";
import { prisma } from "../../../../../../lib/server/prisma";

export const dynamic = "force-dynamic";

/**
 * Superadmin: nastaví servisní PIN kiosk tabletů pro restauraci (write-only).
 * Tablety stáhnou salt+hash přes /api/devices/config.
 */
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
    const pin = normalizeKioskServicePin(o.pin);
    if (!pin) {
      return NextResponse.json(
        { ok: false, error: "PIN musí mít 4–12 číslic" },
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

    const creds = buildKioskServicePinCredentials(pin);
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        kioskServicePinSalt: creds.kioskServicePinSalt,
        kioskServicePinHash: creds.kioskServicePinHash,
      },
    });

    return NextResponse.json({ ok: true, configured: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}

/** Superadmin: zda je PIN nastavený (bez odhalení hodnoty). */
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
      select: { id: true, kioskServicePinHash: true },
    });
    if (!row) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      configured: Boolean(row.kioskServicePinHash?.trim()),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}
