import { NextResponse } from "next/server";

import { type AdminSession, requireAdminSession } from "../../../../../lib/server/adminGuard";
import { userHasRestaurantAccess } from "../../../../../lib/server/auth";
import { deleteRestaurantBySuperAdmin } from "../../../../../lib/server/deleteRestaurant";
import type { MembershipRole } from "../../../../../lib/server/db";
import { prisma } from "../../../../../lib/server/prisma";

export const dynamic = "force-dynamic";

async function canViewRestaurant(session: AdminSession, restaurantId: string): Promise<boolean> {
  if (session.globalRole === "SUPER_ADMIN") return true;
  return (await userHasRestaurantAccess(session.userId, restaurantId)).ok;
}

async function canUpdateRestaurantName(session: AdminSession, restaurantId: string): Promise<boolean> {
  if (session.globalRole === "SUPER_ADMIN") return true;
  const row = await prisma.membership.findUnique({
    where: { userId_restaurantId: { userId: session.userId, restaurantId } },
    select: { role: true },
  });
  return (row?.role as MembershipRole | undefined) === "RESTAURANT_ADMIN";
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession(req.headers.get("cookie"));
    const { id } = await ctx.params;
    const restaurantId = typeof id === "string" ? id.trim() : "";
    if (!restaurantId) {
      return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    }

    if (!(await canViewRestaurant(session, restaurantId))) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const row = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, name: true, createdAtIso: true },
    });

    if (!row) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, restaurant: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const cookieHeader = req.headers.get("cookie");
    const session = await requireAdminSession(cookieHeader);
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
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (!name || name.length > 200) {
      return NextResponse.json({ ok: false, error: "Invalid name" }, { status: 400 });
    }

    if (!(await canUpdateRestaurantName(session, restaurantId))) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const exists = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } });
    if (!exists?.id) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    await prisma.restaurant.update({ where: { id: restaurantId }, data: { name } });
    const row = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, name: true, createdAtIso: true },
    });
    if (!row) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true, restaurant: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
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

    const result = await deleteRestaurantBySuperAdmin(restaurantId);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      ok: true,
      deletedId: result.deletedId,
      deletedName: result.deletedName,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}

