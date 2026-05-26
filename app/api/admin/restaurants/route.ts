import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";

import { requireAdminSession } from "../../../../lib/server/adminGuard";
import { nowIso } from "../../../../lib/server/db";
import { prisma } from "../../../../lib/server/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await requireAdminSession(req.headers.get("cookie"));
    if (session.globalRole === "SUPER_ADMIN") {
      const rows = await prisma.restaurant.findMany({
        orderBy: { createdAtIso: "desc" },
        select: { id: true, name: true },
      });
      return NextResponse.json({ ok: true, restaurants: rows });
    }
    const rows = await prisma.membership.findMany({
      where: { userId: session.userId },
      select: { restaurant: { select: { id: true, name: true, createdAtIso: true } } },
    });
    const restaurants = rows
      .map((r) => r.restaurant)
      .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso) || a.id.localeCompare(b.id, "en"));
    return NextResponse.json({ ok: true, restaurants: restaurants.map((r) => ({ id: r.id, name: r.name })) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdminSession(req.headers.get("cookie"));
    if (session.globalRole !== "SUPER_ADMIN") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
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
    const restaurantName = typeof o.restaurantName === "string" ? o.restaurantName.trim() : "";
    const managerEmail = typeof o.managerEmail === "string" ? o.managerEmail.trim() : "";
    const managerPassword = typeof o.managerPassword === "string" ? o.managerPassword : "";
    if (!restaurantName || !managerEmail || !managerPassword) {
      return NextResponse.json({ ok: false, error: "Missing restaurantName/managerEmail/managerPassword" }, { status: 400 });
    }

    const createdAtIso = nowIso();
    const restaurantId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(managerPassword, 12);
    const managerEmailTrimmed = managerEmail.trim();

    const result = await prisma.$transaction(async (tx) => {
      await tx.restaurant.create({ data: { id: restaurantId, name: restaurantName, createdAtIso } });

      const existingUser = await tx.user.findFirst({
        where: { email: { equals: managerEmailTrimmed, mode: "insensitive" } },
        select: { id: true },
      });
      const userId = existingUser?.id ?? crypto.randomUUID();

      if (!existingUser?.id) {
        await tx.user.create({
          data: { id: userId, email: managerEmailTrimmed, passwordHash, globalRole: "USER", createdAtIso },
        });
      } else {
        await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      }

      await tx.membership.upsert({
        where: { userId_restaurantId: { userId, restaurantId } },
        update: { role: "RESTAURANT_ADMIN", createdAtIso },
        create: { userId, restaurantId, role: "RESTAURANT_ADMIN", createdAtIso },
      });

      return { userId };
    });

    return NextResponse.json({ ok: true, restaurantId, managerUserId: result.userId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}

